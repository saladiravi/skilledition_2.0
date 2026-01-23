const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "smtp.hostinger.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.HOSTINGER_MAIL_USER,
        pass: process.env.HOSTINGER_MAIL_PASS,
    },
    tls: { rejectUnauthorized: false }
});

transporter.verify(() => {
    console.log("✅ SMTP SERVER READY");
});

exports.sendContactMail = async (data) => {
    await transporter.sendMail({
        from: `"Skilledition" <${process.env.HOSTINGER_MAIL_USER}>`,
        to: process.env.ADMIN_MAIL,
        subject: "SkillEdition New Contact Enquiry",
        text: `
        First Name: ${data.first_name}
        Last Name: ${data.last_name}
        Phone: ${data.phone}
        Email: ${data.email}
        Course: ${data.course}
        Level: ${data.learning_level}
        Heard About: ${data.hear_about}
        role:${data.role}
        `
    });
};
