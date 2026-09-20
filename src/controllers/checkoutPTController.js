import PayOS from '@payos/node'
import { StatusCodes } from 'http-status-codes'
import { env } from '~/config/environment'
import Package from '~/models/Package'
import Transaction from '~/models/Transaction'
import StudentPackage from '~/models/StudentPackage'
import PTWallet from '~/models/PTWallet'
import PTWalletTransaction from '~/models/PTWalletTransaction'
import { calcBookingPricing } from '~/utils/pricingUtils'
import Booking from '~/models/Booking'
import StudentProfile from '~/models/StudentProfile'
import { createSlotsAndSessionsForBooking } from '~/services/booking/generateFromBooking'
import mongoose from 'mongoose'

// Khởi tạo SDK PayOS
const payOS = new PayOS(env.PAYOS_CLIENT_ID, env.PAYOS_API_KEY, env.PAYOS_CHECKSUM_KEY)

// Helper: cộng tiền vào ví PT + ghi lịch sử
/**
 * Ghi nhận tiền vào ví PT một cách idempotent.
 * - Nếu refId/refType đã tồn tại -> bỏ qua, trả về bản ghi cũ
 * - Nếu chưa -> insert transaction + tăng số dư tương ứng
 */
export async function creditPTWalletIdempotent({
    ptId,
    amount,                 // số tiền cộng vào ví
    transactionId,          // refId
    refType = 'Transaction' // mặc định
}) {
    const session = await mongoose.startSession()
    try {
        return await session.withTransaction(async () => {
            // 1) kiểm tra đã có lịch sử ví cho ref này chưa
            const existed = await PTWalletTransaction
                .findOne({ refId: transactionId, refType })
                .session(session)
                .lean()

            if (existed) {
                // ĐÃ ghi trước đó -> không cộng thêm nữa
                return { ok: true, duplicated: true, walletTxn: existed }
            }

            // 2) Tăng số dư ví (đặt chính sách rõ ràng: tiền đã PAID -> vào available)
            const wallet = await PTWallet.findOneAndUpdate(
                { pt: ptId },
                {
                    $inc: { available: amount, totalEarned: amount }
                },
                { upsert: true, new: true, session }
            )

            // 3) Tính số dư sau giao dịch
            const balanceAfter = (wallet.available || 0) + (wallet.pending || 0)

            // 4) Tạo lịch sử ví (unique index refId+refType đảm bảo idempotency)
            const walletTxn = await PTWalletTransaction.create([{
                pt: ptId,
                type: 'earning',
                direction: 'credit',
                amount,
                refId: transactionId,
                refType,
                status: 'completed',
                balanceAfter
            }], { session })

            return { ok: true, duplicated: false, walletTxn: walletTxn[0] }
        })
    } finally {
        session.endSession()
    }
}

/**
 * 1) Student bấm “Mua” gói → tạo Transaction trạng thái 'initiated'
 * POST /api/student/packages/:packageId/checkout/init
 */

// ============ B1) INIT: Booking + Transaction (không gen slot) ============
/**
 * POST /api/checkout/init
 * Body tối thiểu:
 * {
 *   pt: "<PT userId>",
 *   package: "<packageId>",
 *   // booking selections:
 *   pattern: [2,4,6],
 *   slot: { start:"07:30", end:"08:30" },
 *   startDate: "2025-11-17",
 *   mode: "atClient",
 *   // snapshots & pricing (tuỳ chọn, nếu FE đã tính):
 *   clientAddress, ptGymAddress, otherGymAddress,
 *   travelPolicy, travelDistanceKm, travelFee, inRange, exceededByKm,
 *   packageSnapshot, pricing, amount, currency, notes
 * }
 */
const initBookingAndTransaction = async (req, res) => {
    try {
        const studentId = req.user._id;

        // lấy defaultLocation của HV (nếu có)
        const prof = await StudentProfile
            .findOne({ user: studentId })
            .select('defaultLocation')
            .lean();
        const studentDefaultAddr = prof?.defaultLocation || null;

        const {
            pt, package: packageId,
            pattern, slot, startDate, mode,

            // FE có thể gửi, nhưng server sẽ tính lại travel & pricing
            clientAddress, ptGymAddress, otherGymAddress,
            travelPolicy, travelDistanceKm, /* travelFee (bỏ), */ inRange, exceededByKm,

            packageSnapshot: packageSnapshotInput,
            // pricing: pricingInput, amount, currency, notes — có thể bỏ qua để server làm chuẩn
            currency, notes
        } = req.body;

        if (!pt || !packageId || !Array.isArray(pattern) || !slot?.start || !slot?.end || !startDate) {
            return res.status(StatusCodes.BAD_REQUEST)
                .json({ success: false, message: 'Thiếu pt/package/pattern/slot/startDate' });
        }

        const pkg = await Package.findById(packageId).populate('pt', 'name isActive visibility');
        if (!pkg || !pkg.isActive) {
            return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Gói không khả dụng' });
        }
        if (pkg.visibility === 'private') {
            return res.status(StatusCodes.FORBIDDEN).json({ success: false, message: 'Gói này không bán công khai' });
        }

        // snapshot gói (server làm chuẩn nếu FE không gửi)
        const pkgSnap = packageSnapshotInput || {
            name: pkg.name,
            price: pkg.price || 0,
            currency: 'VND',
            totalSessions: pkg.totalSessions,
            sessionDurationMin: pkg.sessionDurationMin
        };

        // server tính pricing
        const pricingR = calcBookingPricing({
            mode,
            base: pkgSnap.price || 0,
            tax: 0,
            discount: 0,
            travelDistanceKm: Number.isFinite(travelDistanceKm) ? travelDistanceKm : 0,
            travelPolicy: travelPolicy || { freeRadiusKm: 6, maxTravelKm: 20, feePerKm: 1000 }
        });

        const amountR = pricingR.total;                    // ✅ đúng biến
        const currencySnap = currency || pkgSnap.currency || 'VND';

        const booking = await Booking.create({
            student: studentId,
            pt: pkg.pt._id,
            package: pkg._id,

            pattern,
            slot,
            startDate: new Date(`${startDate}T00:00:00`),
            mode,

            // địa chỉ: ưu tiên FE; fallback profile defaultLocation
            clientAddress: clientAddress || studentDefaultAddr || null,
            ptGymAddress: ptGymAddress || null,
            otherGymAddress: otherGymAddress || null,

            travelPolicy: travelPolicy || undefined,
            travelDistanceKm: Number.isFinite(travelDistanceKm) ? travelDistanceKm : 0,
            travelFee: pricingR.travel,                       // ✅ đồng nhất với pricing
            inRange: inRange ?? true,
            exceededByKm: exceededByKm ?? 0,

            packageSnapshot: pkgSnap,
            pricing: pricingR,                                // ✅ đồng nhất
            amount: amountR,                                 // luôn dùng giá server tính
            currency: currencySnap,

            status: 'PENDING_PAYMENT',
            notes: notes || undefined
        });

        const trans = await Transaction.create({
            student: studentId,
            pt: pkg.pt._id,
            package: pkg._id,
            booking: booking._id,
            amount: booking.amount,                           // theo booking.amount ở trên
            method: 'payos',
            status: 'initiated'
        });

        return res.status(StatusCodes.CREATED).json({
            success: true,
            data: {
                bookingId: booking._id,
                transactionId: trans._id,
                status: trans.status,
                amount: trans.amount,
                currency: currencySnap,
                package: {
                    id: pkg._id,
                    name: pkg.name,
                    ptName: pkg.pt.name,
                    price: pkg.price,
                    totalSessions: pkg.totalSessions,
                    durationDays: pkg.durationDays
                }
            }
        });
    } catch (e) {
        console.error('initBookingAndTransaction error:', e);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: e.message });
    }
};


/**
 * 2) Student đồng ý điều khoản → tạo link PayOS (QR)
 * POST /api/student/transactions/:transactionId/pay
 * → set status = 'pending_gateway'
 */
const createPaymentLink = async (req, res) => {
    try {
        const { transactionId } = req.params;

        // 1) Lấy transaction và kiểm tra trạng thái
        const trans = await Transaction.findById(transactionId).populate('package');
        if (!trans) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
        }
        if (trans.status !== 'initiated') {
            return res.status(400).json({ success: false, message: 'Trạng thái giao dịch không hợp lệ (phải là initiated)' });
        }

        // 2) Chuẩn hoá dữ liệu
        const amount = Number.parseInt(trans.amount, 10) || 0;
        if (!Number.isInteger(amount) || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ (phải là số nguyên VND > 0)' });
        }

        // PayOS yêu cầu Number cho orderCode
        const orderCode = Number(String(Date.now()).slice(-10));
        const CLIENT_URL = (process.env.CLIENT_URL || (env && env.CLIENT_URL) || 'http://localhost:5173').replace(/\/$/, '');

        const name = (trans.package?.name ?? '').toString().trim() || 'Gói tập PT';
        const description = `${name}`; // luôn là string

        // items phải là array và mỗi item có name/quantity/price number
        const items = [{
            name,
            quantity: 1,
            price: amount
        }];

        // returnUrl & cancelUrl phải là string hợp lệ
        const returnUrl = `${CLIENT_URL}/payment/result?payment=success&orderCode=${orderCode}`;
        const cancelUrl = `${CLIENT_URL}/payment/result?payment=cancelled&orderCode=${orderCode}`;

        const paymentData = {
            orderCode,
            amount,
            description,
            items,
            returnUrl,
            cancelUrl
        };

        // 3) Log chẩn đoán chi tiết
        console.log('[PayOS] Will createPaymentLink with:', {
            orderCode: paymentData.orderCode,
            amount: paymentData.amount,
            description: paymentData.description,
            items: paymentData.items,
            returnUrl: paymentData.returnUrl,
            cancelUrl: paymentData.cancelUrl
        });

        // 4) Gọi PayOS
        let link;
        try {
            link = await payOS.createPaymentLink(paymentData);
        } catch (err) {
            console.error('=== PayOS ERROR RAW ===');
            console.error(err?.response?.data || err?.message || err);
            console.error('=======================');

            const msg =
                err?.response?.data?.description ||
                err?.response?.data?.message ||
                err?.message ||
                'Không tạo được link thanh toán';

            return res.status(500).json({ success: false, message: msg });
        }

        // 5) Cập nhật transaction
        trans.status = 'pending_gateway';
        trans.payosOrderCode = orderCode;
        trans.payosCheckoutUrl = link.checkoutUrl;
        trans.checkoutUrl = link.checkoutUrl;
        await trans.save();

        return res.status(200).json({
            success: true,
            data: {
                transactionId: trans._id,
                orderCode,
                checkoutUrl: link.checkoutUrl,
                status: trans.status
            }
        });
    } catch (error) {
        console.error('[createPaymentLink] error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 3) FE confirm sau redirect (?payment=success&orderCode=...)
 * POST /api/student/payment/confirm  { orderCode }
 * → verify PayOS → set 'paid' → tạo StudentPackage → cộng ví PT
 */

const confirmPayment = async (req, res) => {
    try {
        let { orderCode } = req.body;
        if (orderCode == null) {
            return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'orderCode là bắt buộc' });
        }
        orderCode = Number(orderCode);
        if (!Number.isFinite(orderCode)) {
            return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'orderCode không hợp lệ' });
        }

        const trans = await Transaction
            .findOne({ payosOrderCode: orderCode })
            .populate('package student pt booking');

        if (!trans) {
            return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Không tìm thấy giao dịch' });
        }




        // Đã PAID -> đảm bảo Booking cũng PAID, trả OK
        if (trans.status === 'paid') {
            if (trans.booking && trans.booking.status !== 'PAID') {
                await Booking.updateOne({ _id: trans.booking._id }, { $set: { status: 'PAID' } });
            }
            // ... phần phí, trans.save() xong

            return res.status(StatusCodes.OK).json({ success: true, data: { status: 'paid' } });
        }

        // Xác minh PayOS
        let info;
        try {
            info = await payOS.getPaymentLinkInformation(orderCode);
        } catch (err) {
            console.error('[PayOS getPaymentLinkInformation] error:', err?.response?.data || err?.message || err);
            const msg = err?.response?.data?.description || err?.response?.data?.message || err?.message || 'Không lấy được trạng thái thanh toán từ PayOS';
            return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: msg });
        }

        const status = String(info?.status || '').toUpperCase();
        if (status === 'CANCELLED') {
            await Transaction.updateOne({ _id: trans._id }, { $set: { status: 'cancelled' } });
            if (trans.booking) {
                await Booking.updateOne({ _id: trans.booking._id }, { $set: { status: 'CANCELLED' } });
            }
            return res.status(StatusCodes.OK).json({ success: true, data: { status: 'cancelled' } });
        }
        if (status !== 'PAID') {
            return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Thanh toán chưa được PayOS xác nhận' });
        }

        // Tính fee
        const platformPercent = Number(env.PLATFORM_FEE_PERCENT ?? 20);
        const platformFee = Math.floor(trans.amount * platformPercent / 100);
        const ptEarning = trans.amount - platformFee;

        // Cập nhật transaction
        const gatewayTxnId = info?.transactions?.[0]?.transactionId;
        trans.status = 'paid';
        trans.paidAt = new Date();
        trans.platformFee = platformFee;
        trans.ptEarning = ptEarning;
        if (gatewayTxnId) trans.gatewayTxnId = gatewayTxnId;
        await trans.save();

        // Cập nhật Booking -> PAID
        if (trans.booking) {
            await Booking.updateOne(
                { _id: trans.booking._id },
                { $set: { status: 'PAID', transaction: trans._id } }
            );
        }

        // Tạo StudentPackage nếu chưa có — lấy lịch cố định từ Booking
        let existedSP = await StudentPackage.findOne({ transaction: trans._id }).lean();
        if (!existedSP) {
            const pkg = trans.package;

            // Ưu tiên ngày bắt đầu từ Booking
            let start = new Date();
            let pattern = [];
            let slot = undefined;

            if (trans.booking) {
                const bookingDoc = await Booking.findById(trans.booking._id).lean();
                if (bookingDoc?.startDate) start = new Date(bookingDoc.startDate);
                if (Array.isArray(bookingDoc?.pattern)) pattern = bookingDoc.pattern;
                if (bookingDoc?.slot?.start && bookingDoc?.slot?.end) slot = bookingDoc.slot;
            }

            const end = new Date(start.getTime() + (pkg.durationDays || 30) * 86400000);

             existedSP = await StudentPackage.create({
                student: trans.student._id,
                pt: trans.pt._id,
                package: pkg._id,
                transaction: trans._id,
                booking: trans.booking?._id || null,

                startDate: start,
                endDate: end,
                totalSessions: pkg.totalSessions,
                remainingSessions: pkg.totalSessions,

                pattern,
                slot,              // pre('save') sẽ sinh slotKey/patternKey
                status: 'active',
                isExternal: false,
                createdByPT: false
            });
        }

        try {
            if (trans.booking) {

                const gen = await createSlotsAndSessionsForBooking(trans.booking, existedSP._id);
                console.log('[booking] generated:', gen);
            } else {
                console.warn('[booking] Transaction has no booking link — skip slot/session generation');
            }
        } catch (err) {
            console.error('[booking] generate error:', err);
            // tuỳ chính sách: KHÔNG rollback payment. Có thể queue retry.
        }

        // Cộng ví PT (idempotent)
        const creditResult = await creditPTWalletIdempotent({
            ptId: trans.pt._id,
            amount: ptEarning,
            transactionId: trans._id,
            refType: 'Transaction'
        })

        // (tuỳ chọn) log để theo dõi
        console.log('[wallet credit]', {
            duplicated: creditResult.duplicated,
            txnId: creditResult.walletTxn?._id
        })

        return res.status(StatusCodes.OK).json({
            success: true,
            message: 'Thanh toán thành công',
            data: { transactionId: trans._id, status: 'paid' }
        });
    } catch (error) {
        console.error('[confirmPayment] error:', error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
    }
};



/**
 * (tuỳ chọn) Polling trạng thái
 * GET /api/student/transactions/:transactionId
 */
const getTransactionStatus = async (req, res) => {
    try {
        const { transactionId } = req.params
        const trans = await Transaction.findById(transactionId).select('status payosOrderCode')
        if (!trans) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Không tìm thấy' })
        return res.status(StatusCodes.OK).json({ success: true, data: { status: trans.status } })
    } catch (e) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: e.message })
    }
}

export const checkoutPTController = {
    initBookingAndTransaction,
    createPaymentLink,
    confirmPayment,
    getTransactionStatus
}
