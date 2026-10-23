const express = require("express");
const path = require("path");
const cors = require("cors");
const user = require('./routes/userroutes');
const category = require('./routes/categoryroutes');
const course = require('./routes/courseroutes');
const assignment = require('./routes/assignmentroutes');
const tutor = require('./routes/tutorroutes');
const student = require('./routes/studentroutes');
const studentcourse = require('./routes/studentcourseroutes')
const studentassignment = require('./routes/studentassignmentroutes');
const feedbacks = require('./routes/feedbackroutes');
const announcement = require('./routes/announcementroutes');
const contactroutes = require('./routes/contactroutes');
const internship = require('./routes/internshiproutes');
const chatRoutes = require("./routes/chatRoutes");
const notification = require('./routes/notificationroutes');
const dashboard = require('./routes/dashboardroutes');
const sanitizeInput = require('./middleware/sanitizeInput');
const pool = require("./config/db");
const internshipAssessmentRouter = require("./routes/internshipAssessmentRoutes");
const internshipStudentRouter = require("./routes/internshipStudentRoutes");


const app = express();

app.use((req, res, next) => {
    const start = Date.now();

    console.log(`[START] ${req.method} ${req.originalUrl}`);

    res.on("finish", () => {
        const duration = Date.now() - start;

        console.log(
            `[END] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
        );
    });

    next();
});


app.use(express.json());
// app.use(sanitizeInput);
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "OK",
        uptime: process.uptime(),
        timestamp: new Date()
    });
});

app.use('/userroutes', user);
app.use('/category', category);
app.use('/course', course);
app.use('/assignment', assignment);
app.use('/tutor', tutor);
app.use('/studentcourse', studentcourse);
app.use('/studentassignment', studentassignment);
app.use('/feedbacks', feedbacks);
app.use('/announcement', announcement);
app.use('/contact', contactroutes);
app.use('/student', student);
app.use('/internship', internship);
app.use("/internship-assessments", internshipAssessmentRouter);
app.use("/internship-students", internshipStudentRouter);
app.use('/chat', chatRoutes);
app.use('/notification', notification);
app.use('/dashboard', dashboard);



app.listen(3000, async () => {
    try {
        await pool.query("SELECT 1");

        console.log("DB connected successfully");
        console.log("Server is running on port 3000");
    } catch (error) {
        console.error("Database connection failed:", error.message);
    }
});

process.on("uncaughtException", (err) => {
    console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("UNHANDLED REJECTION:", reason);
});

