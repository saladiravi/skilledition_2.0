const pool = require('../config/db');

exports.writeassignment = async (req, res) => {
    const { student_id, assignment_id, answers, attempt_number } = req.body
    if (!student_id || !assignment_id) {
        return res.status(200).json({
            statusCode: 400,
            message: 'Missing required fields'
        })
    }

    const attempt = await pool.query(
        `SELECT COUNT(*) AS attempts 
        FROM tbl_student_assignment 
        WHERE student_id=$1 AND assignment_id=$2`,
        [student_id, assignment_id]
    );

    const attempts = parseInt(attempt.rows[0].attempts);
    
    if (attempts >= 3) {
        return res.status(400).json({
            statusCode: 400,
            message: 'Attempt limit reached — you cannot attempt this assignment again'
        });
    }


    try {
        let total_marks = 0;

        const result = await pool.query(`INSERT INTO tbl_student_assignment (student_id,assignment_id,total_marks,attempt_number) VALUES($1,$2,$3,$4) RETURNING *`,
            [student_id, assignment_id, total_marks, attempt_number]
        );
        const assign = result.rows[0].student_assignment_id


        for (const a of answers) {
            const { question_id, selected_answer } = a

            const correctResult = await pool.query(
                `SELECT answer FROM tbl_questions WHERE question_id=$1`,
                [question_id]
            );

            const correct_answer = correctResult.rows[0]?.answer || null;
            // console.log(correct_answer,'correct_answer');
            const is_correct = correct_answer === selected_answer;
            console.log(is_correct, 'iscorrect')
            if (is_correct) {
                total_marks += 1
            }


            await pool.query(`INSERT INTO tbl_student_answers (student_assignment_id,question_id,selected_answer,correct_answer,is_correct) VALUES($1,$2,$3,$4,$5)`,
                [assign, question_id, selected_answer, correct_answer, is_correct]
            )
        }
        await pool.query(
            `UPDATE tbl_student_assignment SET total_marks=$1 WHERE student_assignment_id=$2`,
            [total_marks, assign]
        );

        return res.status(200).json({
            statusCode: 200,
            message: 'exam Submit sucessfully',

        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            statusCode: 500,
            message: 'Internal Server Error'
        })
    }
}


exports.getAttemptHistory = async (req, res) => {
    const { student_id, assignment_id } = req.body;

    try {
        const attempts = await pool.query(
            `SELECT student_assignment_id, attempt_number, total_marks, status, created_at
             FROM tbl_student_assignment 
             WHERE student_id=$1 AND assignment_id=$2
             ORDER BY attempt_number ASC`,
            [student_id, assignment_id]
        );

        return res.status(200).json({
            statusCode: 200,
            message: "Attempts fetched",
            attempts: attempts.rows
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
    }
};


exports.getassigmenthistroy = async (req, res) => {
    const { student_id } = req.body;

    if (!student_id) {
        return res.status(400).json({
            statusCode: 400,
            message: 'Missing Required Field'
        });
    }

    try {
        // Check if student exists
        const exitstudent = await pool.query(
            `SELECT user_id FROM tbl_user WHERE user_id=$1 AND role=$2`,
            [student_id, 'student']
        );

        if (exitstudent.rows.length === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: 'Student Not Found'
            });
        }

        // Fetch assignment + answers
        const result = await pool.query(`
            SELECT tsa.*, ta.*, ts.*, tq.*
            FROM tbl_student_assignment AS tsa
            JOIN tbl_student_answers AS ts 
                ON tsa.student_assignment_id = ts.student_assignment_id
            JOIN tbl_assignment AS ta 
                ON tsa.assignment_id = ta.assignment_id
            JOIN tbl_questions AS tq 
                ON ts.question_id = tq.question_id
            WHERE tsa.student_id = $1
            ORDER BY tsa.student_assignment_id DESC
        `, [student_id]);

        const rows = result.rows;

        if (rows.length === 0) {
            return res.status(200).json({
                statusCode: 200,
                message: 'No assignment history found',
                assignments: []
            });
        }

        // Group by student_assignment_id
        const grouped = {};

        rows.forEach(row => {
            const id = row.student_assignment_id;

            if (!grouped[id]) {
                grouped[id] = {
                    student_assignment_id: id,
                    date: row.created_at,
                    assignment_title: row.assignment_title,
                    correct: 0,
                    wrong: 0,
                    total: 0,
                    questions: []
                };
            }

            // Count correct / wrong
            if (row.is_correct) grouped[id].correct++;
            else grouped[id].wrong++;

            grouped[id].total++;

            // Add question object
            grouped[id].questions.push({
                question: row.question,
                options: {
                    a: row.a,
                    b: row.b,
                    c: row.c,
                    d: row.d
                },
                selected_answer: row.selected_answer,
                correct_answer: row.correct_answer,
                is_correct: row.is_correct
            });
        });

        // Convert object → array
        const assignmentHistory = Object.values(grouped);

        return res.status(200).json({
            statusCode: 200,
            message: 'Fetched successfully',
            assignments: assignmentHistory
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            statusCode: 500,
            message: 'Internal Server Error'
        });
    }
};


exports.gethistroy=async(req,res)=>{
    const {student_id} =req.body
    if(!student_id){
        return res.status(200).json({
            statusCode:200
        })
    }
    try{

    }catch(error){
        return res.status(500).json({
            statusCode:500,
            message:'Internal Server Error'
        })
    }
}