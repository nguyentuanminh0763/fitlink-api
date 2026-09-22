import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { env } from "~/config/environment";
import User from "~/models/User";
import PTProfile from "~/models/PTProfile";
import PTWallet from "~/models/PTWallet";
import Package from "~/models/Package";
import { Roles, Genders, PackageTags } from "~/domain/enums";
import { slugify } from "~/utils/formatters";

const seed = async () => {
  try {
    console.log("🌱 Starting FitLink Database Seeder...");
    console.log("Connecting to:", env.MONGODB_URI ? env.MONGODB_URI.replace(/:([^:@]+)@/, ":****@") : "NO URI");

    await mongoose.connect(env.MONGODB_URI);
    console.log("✅ Connected to MongoDB:", mongoose.connection.name);

    // Clean existing data for clean re-seeding
    console.log("🧹 Clearing existing Users, Profiles, Wallets, Packages...");
    await User.deleteMany({});
    await PTProfile.deleteMany({});
    await PTWallet.deleteMany({});
    await Package.deleteMany({});

    const defaultPassword = await bcrypt.hash("123456", 10);

    // 1. ADMIN USER
    console.log("👤 Creating Admin...");
    await User.create({
      name: "FitLink Administrator",
      email: "admin@fitlink.vn",
      password: defaultPassword,
      role: Roles.ADMIN,
      phone: "0901000001",
      gender: Genders.MALE,
      isActive: true,
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200",
    });

    // 2. PERSONAL TRAINERS
    console.log("🏋️ Creating Personal Trainers...");
    const ptUsersData = [
      {
        name: "Nguyễn Văn Hưng",
        email: "pt.hung@fitlink.vn",
        phone: "0902000002",
        gender: Genders.MALE,
        avatar: "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=300",
        bio: "HLV thể hình chuyên nghiệp với 6 năm kinh nghiệm đào tạo tăng cơ, siết mỡ và thiết kế thực đơn ăn uống khoa học.",
        specialties: ["Tăng cơ (Hypertrophy)", "Giảm mỡ chuyên sâu", "Dinh dưỡng Macro"],
        yearsExperience: 6,
        gymName: "FitLink Center Quận 1",
        gymAddress: "123 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP.HCM",
        location: [106.6917, 10.7743],
        ratingAvg: 4.9,
        ratingCount: 24,
        packages: [
          {
            name: "Gói Tăng Cơ Cấp Tốc - 12 Buổi",
            description: "Chương trình tập luyện tối ưu Hypertrophy kết hợp giáo án dinh dưỡng cá nhân hóa 1-1.",
            price: 4800000,
            totalSessions: 12,
            sessionDurationMin: 60,
            durationDays: 45,
            visibility: "public",
            tags: [PackageTags.MUSCLE_GAIN, PackageTags.STRENGTH],
            recurrence: { daysOfWeek: [[1, 3, 5]] },
          },
          {
            name: "Gói Chuyển Hóa Vóc Dáng VIP - 36 Buổi",
            description: "Lộ trình 3 tháng toàn diện cam kết chuẩn form, tăng 4kg cơ nạc và giảm mỡ nội tạng.",
            price: 12900000,
            totalSessions: 36,
            sessionDurationMin: 75,
            durationDays: 100,
            visibility: "public",
            tags: [PackageTags.MUSCLE_GAIN, PackageTags.WEIGHT_LOSS, PackageTags.NUTRITION],
            recurrence: { daysOfWeek: [[1, 3, 5]] },
          },
        ],
      },
      {
        name: "Trần Mai Anh",
        email: "pt.maianh@fitlink.vn",
        phone: "0903000003",
        gender: Genders.FEMALE,
        avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300",
        bio: "Chuyên gia Yoga phục hồi, Pilates và chỉnh dáng lưng tôm, võng lưng cho dân văn phòng và phụ nữ sau sinh.",
        specialties: ["Yoga phục hồi", "Chỉnh dáng tư thế", "Pilates thon gọn"],
        yearsExperience: 4,
        gymName: "Yoga & Fitness Studio Bình Thạnh",
        gymAddress: "45 Điện Biên Phủ, Phường 15, Bình Thạnh, TP.HCM",
        location: [106.7112, 10.7985],
        ratingAvg: 5.0,
        ratingCount: 19,
        packages: [
          {
            name: "Yoga Phục Hồi Cột Sống - 10 Buổi",
            description: "Giải tỏa đau mỏi cổ vai gáy, cải thiện độ dẻo dai và vóc dáng thanh mảnh.",
            price: 4200000,
            totalSessions: 10,
            sessionDurationMin: 60,
            durationDays: 40,
            visibility: "public",
            tags: [PackageTags.REHAB, PackageTags.POSTURE, PackageTags.GENERAL_HEALTH],
            recurrence: { daysOfWeek: [[2, 4, 6]] },
          },
        ],
      },
      {
        name: "Lê Hoàng Long",
        email: "pt.long@fitlink.vn",
        phone: "0904000004",
        gender: Genders.MALE,
        avatar: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=300",
        bio: "Cựu vận động viên Kickboxing. Chuyên huấn luyện thể lực, Cardio HIIT đốt mỡ đỉnh cao và rèn luyện phản xạ.",
        specialties: ["Kickboxing", "Cardio HIIT đốt mỡ", "Sức bền & Tốc độ"],
        yearsExperience: 5,
        gymName: "Long Boxing Arena",
        gymAddress: "220 Võ Thị Sáu, Quận 3, TP.HCM",
        location: [106.6881, 10.7852],
        ratingAvg: 4.8,
        ratingCount: 15,
        packages: [
          {
            name: "Kickboxing Giảm Mỡ Cường Độ Cao - 15 Buổi",
            description: "Đốt 700-900 kcal/buổi với bài tập liên hoàn đấm đá kết hợp rèn luyện sức bền.",
            price: 5500000,
            totalSessions: 15,
            sessionDurationMin: 60,
            durationDays: 60,
            visibility: "public",
            tags: [PackageTags.WEIGHT_LOSS, PackageTags.ENDURANCE, PackageTags.STRENGTH],
            recurrence: { daysOfWeek: [[1, 3, 5]] },
          },
        ],
      },
      {
        name: "Phạm Minh Tuấn",
        email: "pt.tuan@fitlink.vn",
        phone: "0902000004",
        gender: Genders.MALE,
        avatar: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=300",
        bio: "Chuyên gia Calisthenics đường phố và rèn luyện sức mạnh cốt lõi (Core & Bodyweight).",
        specialties: ["Calisthenics", "Sức mạnh Bodyweight", "Chỉnh cơ liên sườn"],
        yearsExperience: 5,
        gymName: "Street Workout Center Ba Đình",
        gymAddress: "88 Liễu Giai, Ba Đình, Hà Nội",
        location: [105.8152, 21.0348],
        ratingAvg: 4.9,
        ratingCount: 31,
        packages: [
          {
            name: "Làm Chủ Thể Trọng Calisthenics - 12 Buổi",
            description: "Học kỹ thuật Muscle-up, Handstand và tăng sức mạnh tổng thể từ cơ bản đến nâng cao.",
            price: 4500000,
            totalSessions: 12,
            sessionDurationMin: 60,
            durationDays: 45,
            visibility: "public",
            tags: [PackageTags.STRENGTH, PackageTags.MUSCLE_GAIN],
            recurrence: { daysOfWeek: [[2, 4, 6]] },
          },
        ],
      },
      {
        name: "Vũ Thảo Vy",
        email: "pt.thaovy@fitlink.vn",
        phone: "0902000005",
        gender: Genders.FEMALE,
        avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300",
        bio: "Huấn luyện viên chuyên biệt cho nữ giới: Siết eo con kiến, nâng vòng 3 tự nhiên và thực đơn Eat Clean.",
        specialties: ["Giảm mỡ nữ", "Độ mông đùi (Booty)", "Dinh dưỡng Eat Clean"],
        yearsExperience: 4,
        gymName: "Elite Fitness Cầu Giấy",
        gymAddress: "241 Xuân Thủy, Cầu Giấy, Hà Nội",
        location: [105.7876, 21.0365],
        ratingAvg: 4.9,
        ratingCount: 42,
        packages: [
          {
            name: "Siết Eo & Nâng Mông Quả Đào - 18 Buổi",
            description: "Chương trình tập trung kích hoạt nhóm cơ mông, thon gọn đùi và siết rãnh bụng số 11.",
            price: 6800000,
            totalSessions: 18,
            sessionDurationMin: 60,
            durationDays: 60,
            visibility: "public",
            tags: [PackageTags.WEIGHT_LOSS, PackageTags.POSTURE],
            recurrence: { daysOfWeek: [[1, 3, 5]] },
          },
        ],
      },
      {
        name: "Đặng Hoàng Nam",
        email: "pt.nam@fitlink.vn",
        phone: "0902000006",
        gender: Genders.MALE,
        avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300",
        bio: "Vận động viên Men's Physique đạt nhiều huy chương quốc gia. Kèm 1-1 chuyên sâu form tạ chuẩn.",
        specialties: ["Thể hình chuyên nghiệp", "Tăng cơ Hypertrophy", "Chuẩn bị thi đấu"],
        yearsExperience: 7,
        gymName: "Pro Gym & Fitness Quận 7",
        gymAddress: "102 Nguyễn Thị Thập, Tân Phú, Quận 7, TP.HCM",
        location: [106.7219, 10.7327],
        ratingAvg: 5.0,
        ratingCount: 38,
        packages: [
          {
            name: "Xây Dựng Cơ Bắp Chuẩn Men Physique - 24 Buổi",
            description: "Chiến lược nâng tạ nâng cao Progressive Overload kết hợp theo dõi macro protein chuẩn chỉnh.",
            price: 9200000,
            totalSessions: 24,
            sessionDurationMin: 75,
            durationDays: 90,
            visibility: "public",
            tags: [PackageTags.MUSCLE_GAIN, PackageTags.STRENGTH],
            recurrence: { daysOfWeek: [[1, 3, 5]] },
          },
        ],
      },
      {
        name: "Trịnh Thu Hà",
        email: "pt.thuha@fitlink.vn",
        phone: "0902000007",
        gender: Genders.FEMALE,
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300",
        bio: "Chứng chỉ quốc tế Stott Pilates. Chuyên trị đau thắt lưng, cải thiện vẹo cột sống và cân bằng cơ thể.",
        specialties: ["Pilates Reformer", "Chỉnh cong vẹo cột sống", "Phục hồi chức năng"],
        yearsExperience: 5,
        gymName: "Danang Pilates Studio Hải Châu",
        gymAddress: "45 Bạch Đằng, Hải Châu, Đà Nẵng",
        location: [108.2241, 16.0678],
        ratingAvg: 4.8,
        ratingCount: 22,
        packages: [
          {
            name: "Pilates Trị Liệu Cột Sống Chuyên Sâu - 12 Buổi",
            description: "Sử dụng máy Reformer và Cadillac giúp giải tỏa áp lực đĩa đệm và điều chỉnh tư thế chuẩn.",
            price: 5400000,
            totalSessions: 12,
            sessionDurationMin: 60,
            durationDays: 45,
            visibility: "public",
            tags: [PackageTags.REHAB, PackageTags.POSTURE],
            recurrence: { daysOfWeek: [[2, 4, 6]] },
          },
        ],
      },
      {
        name: "Ngô Quốc Bảo",
        email: "pt.baongo@fitlink.vn",
        phone: "0902000008",
        gender: Genders.MALE,
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300",
        bio: "HLV Boxing & Thể lực cấp cao. Đào tạo học viên từ cơ bản tự vệ đến nâng cao tốc độ phản xạ.",
        specialties: ["Boxing đối kháng", "Tự vệ thực chiến", "Rèn luyện thể lực"],
        yearsExperience: 6,
        gymName: "Sơn Trà Boxing Club",
        gymAddress: "15 Võ Văn Kiệt, Sơn Trà, Đà Nẵng",
        location: [108.2415, 16.0601],
        ratingAvg: 4.9,
        ratingCount: 27,
        packages: [
          {
            name: "Boxing Tự Vệ & Đốt Mỡ Cấp Tốc - 15 Buổi",
            description: "Học đòn đấm, né đòn cơ bản, di chuyển bộ chân và bài tập thể lực đai lưng toàn diện.",
            price: 5200000,
            totalSessions: 15,
            sessionDurationMin: 60,
            durationDays: 60,
            visibility: "public",
            tags: [PackageTags.ENDURANCE, PackageTags.WEIGHT_LOSS],
            recurrence: { daysOfWeek: [[1, 3, 5]] },
          },
        ],
      },
      {
        name: "Bùi Đức Trọng",
        email: "pt.trong@fitlink.vn",
        phone: "0902000009",
        gender: Genders.MALE,
        avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300",
        bio: "Cử nhân Y sinh Thể thao. Chuyên phục hồi cơ khớp sau chấn thương và trị liệu cơ sâu (Deep Tissue).",
        specialties: ["Phục hồi chấn thương", "Giãn cơ sâu (Stretching)", "Chỉnh sai lệch khớp"],
        yearsExperience: 8,
        gymName: "Recovery & Fitness Lab Tân Bình",
        gymAddress: "18 Phổ Quang, Phường 2, Tân Bình, TP.HCM",
        location: [106.6662, 10.8031],
        ratingAvg: 5.0,
        ratingCount: 49,
        packages: [
          {
            name: "Phục Hồi Chấn Thương & Giải Cơ Sâu - 10 Buổi",
            description: "Kỹ thuật giãn cơ thụ động PNF kết hợp bài tập củng cố gân khớp giúp hết đau mỏi mãn tính.",
            price: 4900000,
            totalSessions: 10,
            sessionDurationMin: 60,
            durationDays: 40,
            visibility: "public",
            tags: [PackageTags.REHAB, PackageTags.GENERAL_HEALTH],
            recurrence: { daysOfWeek: [[2, 4, 6]] },
          },
        ],
      },
      {
        name: "Lê Phương Linh",
        email: "pt.linhle@fitlink.vn",
        phone: "0902000010",
        gender: Genders.FEMALE,
        avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300",
        bio: "HLV Dance Cardio & Aerobic tràn đầy năng lượng. Truyền cảm hứng tập luyện vui khỏe giảm cân bền vững.",
        specialties: ["Dance Cardio", "Aerobic siết cân", "Thể lực năng động"],
        yearsExperience: 4,
        gymName: "Linh Dance & Fitness Đống Đa",
        gymAddress: "12 Chùa Bộc, Đống Đa, Hà Nội",
        location: [105.8286, 21.0073],
        ratingAvg: 4.8,
        ratingCount: 36,
        packages: [
          {
            name: "Dance Cardio Đốt Mỡ Vui Khỏe - 16 Buổi",
            description: "Âm nhạc sôi động, nhịp điệu nhanh giúp tiêu hao 600kcal mỗi buổi mà không hề áp lực.",
            price: 4600000,
            totalSessions: 16,
            sessionDurationMin: 60,
            durationDays: 60,
            visibility: "public",
            tags: [PackageTags.WEIGHT_LOSS, PackageTags.GENERAL_HEALTH],
            recurrence: { daysOfWeek: [[2, 4, 6]] },
          },
        ],
      },
    ];

    for (const ptData of ptUsersData) {
      const user = await User.create({
        name: ptData.name,
        email: ptData.email,
        phone: ptData.phone,
        password: defaultPassword,
        role: Roles.PT,
        gender: ptData.gender,
        avatar: ptData.avatar,
        isActive: true,
      });

      await PTProfile.create({
        user: user._id,
        bio: ptData.bio,
        specialties: ptData.specialties,
        yearsExperience: ptData.yearsExperience,
        primaryGym: {
          name: ptData.gymName,
          address: ptData.gymAddress,
          location: {
            type: "Point",
            coordinates: ptData.location,
          },
          photos: [
            "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500",
          ],
        },
        deliveryModes: {
          atPtGym: true,
          atClient: true,
          atOtherGym: false,
        },
        travelPolicy: {
          enabled: true,
          freeRadiusKm: 5,
          maxTravelKm: 15,
          feePerKm: 10000,
        },
        workingHours: [
          { dayOfWeek: 1, intervals: [{ start: "07:00", end: "21:00" }] },
          { dayOfWeek: 2, intervals: [{ start: "07:00", end: "21:00" }] },
          { dayOfWeek: 3, intervals: [{ start: "07:00", end: "21:00" }] },
          { dayOfWeek: 4, intervals: [{ start: "07:00", end: "21:00" }] },
          { dayOfWeek: 5, intervals: [{ start: "07:00", end: "21:00" }] },
          { dayOfWeek: 6, intervals: [{ start: "08:00", end: "18:00" }] },
        ],
        availableForNewClients: true,
        verified: true,
        ratingAvg: ptData.ratingAvg,
        ratingCount: ptData.ratingCount,
      });

      await PTWallet.create({
        pt: user._id,
        available: 3500000,
        pending: 1200000,
        totalEarned: 18500000,
        withdrawn: 13800000,
      });

      for (const pkg of ptData.packages) {
        await Package.create({
          ...pkg,
          pt: user._id,
        });
      }
    }

    // ============================================================
    // 2b. SINH THÊM 90 PT TRẢI ĐỦ 3 MIỀN (tổng cộng 100 PT)
    // ============================================================
    // Sinh theo chỉ số, không dùng random, để mỗi lần seed ra đúng cùng một tập
    // dữ liệu — cần thiết khi kiểm chứng phân trang và tìm kiếm theo toạ độ.
    console.log("🗺️  Creating 90 generated PTs across 3 regions...");

    const REGIONS = [
      {
        name: "Miền Bắc",
        cities: [
          { city: "Hà Nội", area: "Phường Dịch Vọng, Cầu Giấy", coords: [105.7905, 21.0333] },
          { city: "Hà Nội", area: "Phường Bách Khoa, Hai Bà Trưng", coords: [105.8467, 21.0051] },
          { city: "Hải Phòng", area: "Phường Máy Tơ, Ngô Quyền", coords: [106.6881, 20.8449] },
          { city: "Quảng Ninh", area: "Phường Bãi Cháy, Hạ Long", coords: [107.0448, 20.9518] },
          { city: "Bắc Ninh", area: "Phường Suối Hoa", coords: [106.0763, 21.1861] },
          { city: "Thái Nguyên", area: "Phường Hoàng Văn Thụ", coords: [105.8442, 21.5942] },
          { city: "Nam Định", area: "Phường Vị Hoàng", coords: [106.1683, 20.4388] },
        ],
      },
      {
        name: "Miền Trung",
        cities: [
          { city: "Đà Nẵng", area: "Phường Thạch Thang, Hải Châu", coords: [108.2208, 16.0678] },
          { city: "Đà Nẵng", area: "Phường Mỹ An, Ngũ Hành Sơn", coords: [108.2450, 16.0344] },
          { city: "Thừa Thiên Huế", area: "Phường Vĩnh Ninh, Huế", coords: [107.5909, 16.4637] },
          { city: "Khánh Hoà", area: "Phường Lộc Thọ, Nha Trang", coords: [109.1967, 12.2388] },
          { city: "Quảng Nam", area: "Phường Minh An, Hội An", coords: [108.3300, 15.8801] },
          { city: "Bình Định", area: "Phường Lê Lợi, Quy Nhơn", coords: [109.2237, 13.7829] },
          { city: "Nghệ An", area: "Phường Hưng Bình, Vinh", coords: [105.6921, 18.6733] },
        ],
      },
      {
        name: "Miền Nam",
        cities: [
          { city: "TP.HCM", area: "Phường Bến Nghé, Quận 1", coords: [106.7009, 10.7797] },
          { city: "TP.HCM", area: "Phường Tân Sơn Nhì, Tân Phú", coords: [106.6297, 10.7969] },
          { city: "TP.HCM", area: "Phường Hiệp Bình Chánh, Thủ Đức", coords: [106.7245, 10.8320] },
          { city: "Đồng Nai", area: "Phường Trung Dũng, Biên Hoà", coords: [106.8296, 10.9574] },
          { city: "Cần Thơ", area: "Phường Xuân Khánh, Ninh Kiều", coords: [105.7700, 10.0300] },
          { city: "Bình Dương", area: "Phường Phú Hoà, Thủ Dầu Một", coords: [106.6519, 10.9804] },
          { city: "Bà Rịa - Vũng Tàu", area: "Phường Thắng Tam, Vũng Tàu", coords: [107.0843, 10.3460] },
        ],
      },
    ];

    const SURNAMES = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương"];
    const MALE_GIVEN = ["Văn Hùng", "Minh Tuấn", "Quốc Bảo", "Hữu Thắng", "Đức Anh", "Thanh Sơn", "Gia Huy", "Trọng Nghĩa", "Xuân Trường", "Công Vinh", "Nhật Nam", "Tiến Dũng", "Khắc Huy", "Anh Khoa", "Bá Lộc"];
    const FEMALE_GIVEN = ["Minh Châu", "Thu Hà", "Ngọc Ánh", "Khánh Linh", "Phương Thảo", "Hải Yến", "Bảo Trân", "Diễm My", "Mai Chi", "Thanh Tâm", "Tuyết Nhi", "Quỳnh Anh", "Hà Vy", "Lan Hương", "Thuỳ Dung"];
    const STREETS = ["Nguyễn Trãi", "Lê Lợi", "Trần Phú", "Hai Bà Trưng", "Quang Trung", "Nguyễn Huệ", "Lý Thường Kiệt", "Phan Chu Trinh", "Hoàng Hoa Thám", "Nguyễn Thị Minh Khai"];

    const ARCHETYPES = [
      {
        gymPrefix: "Iron House Gym",
        specialties: ["Tăng cơ (Hypertrophy)", "Sức mạnh nền tảng", "Dinh dưỡng Macro"],
        bio: "HLV thể hình tập trung vào tăng cơ nạc, chuẩn form động tác và giáo án dinh dưỡng theo từng giai đoạn.",
        pkgName: "Gói Tăng Cơ Nền Tảng",
        pkgDesc: "Giáo án Hypertrophy chia nhóm cơ, theo dõi khối lượng tập và điều chỉnh mỗi tuần.",
        basePrice: 4200000, sessions: 12, durationMin: 60, days: 45,
        tags: [PackageTags.MUSCLE_GAIN, PackageTags.STRENGTH],
        daysOfWeek: [1, 3, 5],
      },
      {
        gymPrefix: "Zen Yoga Studio",
        specialties: ["Yoga phục hồi", "Pilates cơ bản", "Chỉnh dáng tư thế"],
        bio: "Chuyên Yoga trị liệu và Pilates cho dân văn phòng bị đau cổ vai gáy, võng lưng và lệch vai.",
        pkgName: "Gói Yoga Chỉnh Dáng",
        pkgDesc: "Kết hợp thở, giãn cơ sâu và bài tập cột sống giúp cải thiện tư thế sau 10 buổi.",
        basePrice: 3800000, sessions: 10, durationMin: 60, days: 40,
        tags: [PackageTags.POSTURE, PackageTags.REHAB, PackageTags.GENERAL_HEALTH],
        daysOfWeek: [2, 4, 6],
      },
      {
        gymPrefix: "Warrior Boxing Club",
        specialties: ["Boxing cơ bản", "Kickboxing", "Thể lực & phản xạ"],
        bio: "Cựu vận động viên đối kháng, huấn luyện kỹ thuật boxing, thể lực nền và phản xạ cho người mới.",
        pkgName: "Gói Boxing Nhập Môn",
        pkgDesc: "Học đòn tay cơ bản, di chuyển chân và thể lực đối kháng, phù hợp người chưa từng tập.",
        basePrice: 4500000, sessions: 14, durationMin: 75, days: 50,
        tags: [PackageTags.ENDURANCE, PackageTags.STRENGTH],
        daysOfWeek: [2, 4, 6],
      },
      {
        gymPrefix: "Shape Up Fitness",
        specialties: ["Giảm mỡ chuyên sâu", "Cardio HIIT", "Tư vấn thực đơn"],
        bio: "Chuyên lộ trình giảm mỡ bền vững, không nhịn ăn cực đoan, bám sát chỉ số cơ thể hàng tuần.",
        pkgName: "Gói Giảm Mỡ 8 Tuần",
        pkgDesc: "Kết hợp HIIT và tập kháng lực, kèm thực đơn linh hoạt theo khẩu vị người Việt.",
        basePrice: 4900000, sessions: 16, durationMin: 60, days: 60,
        tags: [PackageTags.WEIGHT_LOSS, PackageTags.NUTRITION],
        daysOfWeek: [1, 3, 5],
      },
      {
        gymPrefix: "ReCore Rehab Center",
        specialties: ["Phục hồi chấn thương", "Vật lý trị liệu thể thao", "Tập cho người lớn tuổi"],
        bio: "Nền tảng vật lý trị liệu, chuyên hỗ trợ phục hồi sau chấn thương gối, vai và thoát vị đĩa đệm nhẹ.",
        pkgName: "Gói Phục Hồi Vận Động",
        pkgDesc: "Bài tập cường độ thấp tăng dần, ưu tiên an toàn khớp và kiểm soát cơn đau.",
        basePrice: 5200000, sessions: 12, durationMin: 50, days: 50,
        tags: [PackageTags.REHAB, PackageTags.GENERAL_HEALTH],
        daysOfWeek: [2, 4, 6],
      },
      {
        gymPrefix: "Pulse Dance & Cardio",
        specialties: ["Dance Cardio", "Zumba", "Tăng sức bền"],
        bio: "Huấn luyện Dance Cardio và Zumba, buổi tập vui, cường độ vừa, phù hợp người ngại phòng tạ.",
        pkgName: "Gói Dance Cardio Vui Khoẻ",
        pkgDesc: "Nhịp điệu sôi động giúp tiêu hao năng lượng mà không tạo áp lực tâm lý khi mới bắt đầu.",
        basePrice: 3600000, sessions: 16, durationMin: 60, days: 60,
        tags: [PackageTags.WEIGHT_LOSS, PackageTags.ENDURANCE],
        daysOfWeek: [1, 3, 5],
      },
    ];

    const GEN_COUNT = 90;
    const genMeta = [];
    const genUsers = [];

    for (let i = 0; i < GEN_COUNT; i++) {
      const region = REGIONS[i % REGIONS.length];
      const city = region.cities[Math.floor(i / REGIONS.length) % region.cities.length];
      const arch = ARCHETYPES[i % ARCHETYPES.length];
      const isMale = i % 2 === 0;
      const given = isMale ? MALE_GIVEN[i % MALE_GIVEN.length] : FEMALE_GIVEN[i % FEMALE_GIVEN.length];
      const name = `${SURNAMES[i % SURNAMES.length]} ${given}`;
      const seq = i + 11; // tiếp nối 10 PT viết tay ở trên

      genUsers.push({
        name,
        email: `pt.${slugify(name)}${seq}@fitlink.vn`,
        phone: `0${910000000 + i}`,
        password: defaultPassword,
        role: Roles.PT,
        gender: isMale ? Genders.MALE : Genders.FEMALE,
        avatar: isMale
          ? "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=300"
          : "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300",
        isActive: true,
      });

      genMeta.push({ i, seq, name, region, city, arch });
    }

    const createdPTs = await User.insertMany(genUsers);

    const genProfiles = createdPTs.map((u, idx) => {
      const { i, seq, name, region, city, arch } = genMeta[idx];
      // Toạ độ lệch nhẹ quanh tâm thành phố (~1km mỗi bước) để PT không chồng lên nhau
      const lng = Number((city.coords[0] + ((i % 7) - 3) * 0.008).toFixed(6));
      const lat = Number((city.coords[1] + ((i % 5) - 2) * 0.008).toFixed(6));

      return {
        user: u._id,
        slug: `${slugify(name)}-${seq}`,
        bio: arch.bio,
        specialties: arch.specialties,
        yearsExperience: 2 + (i % 9),
        primaryGym: {
          name: `${arch.gymPrefix} ${city.city}`,
          address: `${12 + (i % 200)} ${STREETS[i % STREETS.length]}, ${city.area}, ${city.city}`,
          location: { type: "Point", coordinates: [lng, lat] },
          photos: ["https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500"],
        },
        areaNote: `${city.city} - ${region.name}`,
        deliveryModes: {
          atPtGym: true,
          atClient: i % 3 !== 0,
          atOtherGym: i % 4 === 0,
        },
        travelPolicy: {
          enabled: true,
          freeRadiusKm: 4 + (i % 4),
          maxTravelKm: 12 + (i % 9),
          feePerKm: 8000 + (i % 3) * 2000,
        },
        workingHours: [1, 2, 3, 4, 5, 6].map((d) => ({
          dayOfWeek: d,
          intervals: [{ start: d === 6 ? "08:00" : "06:30", end: d === 6 ? "18:00" : "21:00" }],
        })),
        availableForNewClients: true,
        verified: true,
        ratingAvg: Number((4 + ((i * 7) % 10) / 10).toFixed(1)),
        ratingCount: 5 + ((i * 13) % 60),
      };
    });

    const genWallets = createdPTs.map((u, idx) => ({
      pt: u._id,
      available: 1000000 + (genMeta[idx].i % 12) * 500000,
      pending: (genMeta[idx].i % 5) * 400000,
      totalEarned: 6000000 + (genMeta[idx].i % 20) * 1500000,
      withdrawn: (genMeta[idx].i % 9) * 800000,
    }));

    const genPackages = createdPTs.map((u, idx) => {
      const { i, arch } = genMeta[idx];
      return {
        pt: u._id,
        name: `${arch.pkgName} - ${arch.sessions} Buổi`,
        description: arch.pkgDesc,
        price: arch.basePrice + (i % 5) * 300000,
        totalSessions: arch.sessions,
        sessionDurationMin: arch.durationMin,
        durationDays: arch.days,
        visibility: "public",
        isActive: true,
        tags: arch.tags,
        recurrence: { daysOfWeek: [arch.daysOfWeek] },
      };
    });

    await PTProfile.insertMany(genProfiles);
    await PTWallet.insertMany(genWallets);
    await Package.insertMany(genPackages);

    const regionCount = REGIONS.map((r) => ({
      region: r.name,
      count: genMeta.filter((m) => m.region.name === r.name).length,
    }));

    // 3. STUDENTS
    console.log("🎓 Creating Students...");
    const studentUsers = [
      {
        name: "Đặng Tuấn Kiệt",
        email: "student.kiet@fitlink.vn",
        phone: "0905000005",
        gender: Genders.MALE,
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
      },
      {
        name: "Phạm Thu Trang",
        email: "student.trang@fitlink.vn",
        phone: "0906000006",
        gender: Genders.FEMALE,
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
      },
    ];

    for (const stu of studentUsers) {
      await User.create({
        ...stu,
        password: defaultPassword,
        role: Roles.STUDENT,
        isActive: true,
      });
    }

    const totalPTs = await User.countDocuments({ role: Roles.PT });
    const totalPackages = await Package.countDocuments({});

    console.log("\n=========================================");
    console.log("🎉 SEED HOÀN TẤT THÀNH CÔNG RỰC RỠ!");
    console.log("=========================================");
    console.log(`🏋️  Tổng số PT: ${totalPTs}  |  Gói tập: ${totalPackages}`);
    regionCount.forEach((r) => console.log(`   - ${r.region}: ${r.count} PT`));
    console.log("   - 10 PT viết tay (TP.HCM) từ bộ dữ liệu gốc");
    console.log("-----------------------------------------");
    console.log("🔑 Mật khẩu chung cho tất cả tài khoản: 123456");
    console.log("1. Admin:   admin@fitlink.vn");
    console.log("2. PT 1:    pt.hung@fitlink.vn (Gym/Tăng cơ)");
    console.log("3. PT 2:    pt.maianh@fitlink.vn (Yoga/Chỉnh dáng)");
    console.log("4. PT 3:    pt.long@fitlink.vn (Kickboxing)");
    console.log("5. Student: student.kiet@fitlink.vn");
    console.log("6. Student: student.trang@fitlink.vn");
    console.log("=========================================\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed thất bại:", err);
    process.exit(1);
  }
};

seed();
