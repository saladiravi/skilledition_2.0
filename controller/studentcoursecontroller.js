const pool = require('../config/db');
const {getSignedVideoUrl} =require('../utils/s3upload');


exports.studentbuycourse = async (req, res) => {
    const { course_id, student_id } = req.body
    if (!course_id || !student_id) {
        return res.status(400).json({
            statusCode: '400',
            message: 'missing required fields'
        })
    }


    try {
        const exitstudent = await pool.query(`SELECT * FROM tbl_user WHERE user_id=$1 AND role=$2`, [student_id, 'student']);
        if (exitstudent.rows.length === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: 'Student Not Found'
            })
        }
        const exitcourse = await pool.query(`SELECT * FROM tbl_course WHERE course_id=$1`, [course_id]);
        if (exitcourse.rows.length === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: 'Course Not Found'
            })
        }

        const result = await pool.query(`INSERT INTO public.tbl_student_course (student_id,course_id) VALUES($1,$2) RETURNING *`,
            [student_id, course_id]);
            res.status(200).json({
            statusCode: 200,
            message: 'Student buy Sucessfully',
            result: result.rows[0]

        })

    } catch (error) {
        console.log(error)
        return res.status(500).json({
            statusCode: 500,
            message: 'Internal Server Error'
        })
    }
}

exports.getstudentcourse = async (req, res) => {
    const { student_id } = req.body
    if (!student_id) {
        return res.status(400).json({
            statusCode: 400,
            message: 'Missing required field'
        })
    }

    try {
        const exitsstudent = await pool.query(`SELECT * FROM tbl_user WHERE  user_id=$1 AND role=$2`, [student_id, 'student']);
        if (exitsstudent.rows.length === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: 'Student Not Found'
            })
        }
        const result = await pool.query(
                `SELECT ts.*, tc.*
                FROM tbl_student_course AS ts
                JOIN tbl_course AS tc 
                    ON ts.course_id = tc.course_id
                WHERE ts.student_id = $1`,
            [student_id]
        );

        return res.status(200).json({
            statusCode: 200,
            message: 'Fetched Sucessfully',
            course: result.rows
        })

    } catch (error) {
        console.log(error)
        return res.status(500).json({
            statusCode: 500,
            message: 'Internal Server Error'
        })
    }
}


exports.getcoursemodule = async (req, res) => {
    const { course_id } = req.body;

    if (!course_id) {
        return res.status(400).json({
            statusCode: 400,
            message: 'Missing Required Field'
        });
    }

    try {
        const exitcourse = await pool.query(
            `SELECT course_id FROM tbl_student_course WHERE course_id=$1`,
            [course_id]
        );

        if (exitcourse.rows.length === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: 'course Not Found'
            });
        }

        const result = await pool.query(`
            SELECT 
                tc.course_id,
                tc.category_id,
                tc.course_title,
                tc.course_description,
                tc.tutor_id,
                tc.duration,
                tc.no_of_modules,
                tc.level,
                tc.course_image,
                tc.status,
                tc.course_created_at,

                tm.module_id,
                tm.module_title,
                tm.module_description,
                tm.sheet_file
            FROM tbl_course AS tc
            JOIN tbl_module AS tm 
              ON tc.course_id = tm.course_id
            WHERE tc.course_id = $1
        `, [course_id]);

        const rows = result.rows;

        // If no course found
        if (rows.length === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: 'Course Not Found'
            });
        }

        // Build the course object
        const course = {
            course_id: rows[0].course_id,
            category_id: rows[0].category_id,
            course_title: rows[0].course_title,
            course_description: rows[0].course_description,
            tutor_id: rows[0].tutor_id,
            duration: rows[0].duration,
            no_of_modules: rows[0].no_of_modules,
            level: rows[0].level,
            course_image: rows[0].course_image,
            status: rows[0].status,
            course_created_at: rows[0].course_created_at,

            modules: rows.map(m => ({
                module_id: m.module_id,
                module_title: m.module_title,
                module_description: m.module_description,
                sheet_file: m.sheet_file
            }))
        };

        return res.status(200).json({
            statusCode: 200,
            message: "Fetched Successfully",
            course: course
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            statusCode: 500,
            message: "Internal Server Error"
        });
    }
};



exports.getvideobymodule = async (req, res) => {
    const { module_id } = req.body;

    // Fix validation
    if (!module_id) {
        return res.status(400).json({
            statusCode: 400,
            message: 'Missing Required field'
        });
    }

    try {
        // Check module exists
        const exitmodule = await pool.query(
            `SELECT module_id FROM tbl_module WHERE module_id=$1`,
            [module_id]
        );

        if (exitmodule.rows.length === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: 'Module Not Found'
            });
        }

        const result = await pool.query(`
            SELECT 
                tmv.module_video_id,
                tmv.module_id,
                tmv.video,
                tmv.video_title,
                tmv.status,
                tmv.reason,
                tmv.video_duration,
                tmv.module_video_created_at,

                tm.course_id,
                tm.module_title,
                tm.module_description,
                tm.sheet_file,

                ta.assignment_id,
                ta.assignment_title,
                ta.assignment_type,
                ta.total_questions,
                ta.total_marks,
                ta.pass_percentage

            FROM tbl_module_videos AS tmv 
            JOIN tbl_module  AS tm ON tmv.module_id = tm.module_id
            LEFT JOIN tbl_assignment AS ta ON tmv.module_id = ta.module_id
            WHERE tmv.module_id = $1
        `, [module_id]);

        const rows = result.rows;

        if (rows.length === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: "No Videos Found"
            });
        }

        // Build structured response
        const moduleInfo = {
            module_id: rows[0].module_id,
            course_id: rows[0].course_id,
            module_title: rows[0].module_title,
            module_description: rows[0].module_description,
            sheet_file: rows[0].sheet_file
        };

        const assignmentInfo = rows[0].assignment_id ? {
            assignment_id: rows[0].assignment_id,
            assignment_title: rows[0].assignment_title,
            assignment_type: rows[0].assignment_type,
            total_questions: rows[0].total_questions,
            total_marks: rows[0].total_marks,
            pass_percentage: rows[0].pass_percentage
        } : null;

        const videos = rows.map(v => ({
            module_video_id: v.module_video_id,
            video: v.video,
            video_title: v.video_title,
            status: v.status,
            reason: v.reason,
            video_duration: v.video_duration,
            module_video_created_at: v.module_video_created_at
        }));

        return res.status(200).json({
            statusCode: 200,
            message: "Fetched successfully",
            module: moduleInfo,
            assignment: assignmentInfo,
            videos: videos
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            statusCode: 500,
            message: "Internal Server Error"
        });
    }
};



 

