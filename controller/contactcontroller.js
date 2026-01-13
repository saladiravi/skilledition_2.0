const pool = require('../config/db');
const {sendContactMail}=require('../utils/mail');

 
exports.addContact = async (req, res) => {

    const {
        first_name,
        last_name,
        phone,
        email,
        course,
        learning_level,
        hear_about
    } = req.body;

    if (!first_name || !last_name || !phone || !email || !course || !learning_level) {
        return res.status(400).json({
            statusCode: 400,
            message: 'Missing required fields'
        });
    }

    try {

        // Save to DB
        const result = await pool.query(
            `INSERT INTO tbl_contact 
            (first_name, last_name, phone, email, course, learning_level, hear_about)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            RETURNING *`,
            [
                first_name,
                last_name,
                phone,
                email,
                course,
                learning_level,
                hear_about
            ]
        );

        // Send Mail
        await sendContactMail({
            first_name,
            last_name,
            phone,
            email,
            course,
            learning_level,
            hear_about
        });

        return res.status(200).json({
            statusCode: 200,
            message: 'Contact submitted & mail sent successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            statusCode: 500,
            message: 'Internal Server Error'
        });
    }
};
