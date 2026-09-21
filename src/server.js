import express from "express";
import "express-async-errors";
import { env } from "~/config/environment";
import { errorHandlingMiddleware } from "~/middlewares/errorHandlingMiddleware";
import { connectDB } from "~/config/database";
import searchRoutes from "./routes/searchRoutes.js";
import studentMaterialRoutes from "./routes/studentMaterialRoutes.js";
// router
import authRoutes from "~/routes/authRoutes";
import studentRoutes from "./routes/studentRoutes.js";
import trainingSessionRoutes from "./routes/trainingSessionRoutes.js";
import studentPackageRoutes from "./routes/studentPackageRoutes.js";
// admin
import adminRoutes from "./routes/adminRoutes";
import transactionRoutes from "./routes/transactionRoutes.js";
// pt
import ptPackageRoutes from "./routes/ptPackageRoutes";
import ptProfileRoutes from "./routes/ptProfileRoutes";
import ptStudentRoutes from "./routes/ptStudentRoutes";
import ptApprovalRoutes from "./routes/ptApprovalRoutes.js";
import ptRoutes from "./routes/ptRoutes";
import ptWalletRoues from "./routes/ptWalletRoutes";
import scheduleRoutes from "~/routes/scheduleRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import studentCheckoutRoutes from "./routes/studentCheckoutRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";

import ptMaterialRoutes from "./routes/ptMaterialRoutes.js";

import feedbackRoutes from "./routes/feedbackRoutes.js";

import payoutRoutes from "./routes/payoutRoutes.js";

// student
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";
import http from "http";

// notification
import notificationRoutes from "./routes/notificationRoutes.js";

// 🆕 Thêm dòng này
import { initChatSocket } from "./sockets/chatSocket.js";

const START_SERVER = () => {
  const app = express();
  const server = http.createServer(app); // ✅ tạo HTTP server trước
  app.set("trust proxy", 1); // nếu deploy lên Heroku hoặc Vercel thì mở dòng này
  app.use(express.json());
  app.use(morgan("dev"));
  const allowedOrigins = [
    env.CLIENT_URL,
    "http://localhost:5173",
    "http://localhost:8080",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
  ].filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
    })
  );
  app.use(cookieParser());

  app.use((req, res, next) => {
    if (req.path.startsWith("/socket.io")) return;
    next();
  });

  // Healthcheck endpoint for Docker & K8s probes
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "healthy",
      service: "fitlink-backend-api",
      timestamp: new Date().toISOString()
    });
  });

  // user router
  app.use("/api/search", searchRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/student", studentRoutes);
  app.use("/api/pt", ptRoutes);
  app.use("/api/pt", ptPackageRoutes);
  app.use("/api/pt", ptStudentRoutes);
  app.use("/api/pt", ptWalletRoues);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/pt", ptApprovalRoutes);
  app.use("/api/messages", messageRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/pt", scheduleRoutes);
  app.use("/api/booking", bookingRoutes);
  app.use("/api/student", studentCheckoutRoutes);
  app.use("/api/sessions", sessionRoutes);
  app.use("/api/training-sessions", trainingSessionRoutes);
  app.use("/api/student-packages", studentPackageRoutes);
  app.use("/api/admin/transactions", transactionRoutes);
  app.use("/api/pt", ptMaterialRoutes);
  app.use("/api/pt", ptProfileRoutes);
  app.use("/api/student", studentMaterialRoutes);

  // cho FE truy cập file đã upload
  app.use("/uploads", express.static("uploads"));
  app.use("/api/feedbacks", feedbackRoutes);

  app.use("/api/payouts", payoutRoutes);

  app.use(errorHandlingMiddleware);

  // 🆕 Thêm dòng này sau khi app config xong
  initChatSocket(server);

  server.listen(env.APP_PORT, env.APP_HOST, () => {
    console.log(`✅ Server running at http://${env.APP_HOST}:${env.APP_PORT}/`);
  });
};

(async () => {
  try {
    console.log("1. Connecting to MongoDB Cloud Atlas");
    await connectDB();
    console.log("2. Connected to MongoDB Cloud Atlas");
    START_SERVER();
  } catch (error) {
    console.error(error);
    process.exit(0);
  }
})();
