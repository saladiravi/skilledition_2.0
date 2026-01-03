const pool=require('../config/db');


exports.addasignment = async (req, res) => {
    const { course_id, module_id,assignment_title,assignment_type,total_questions,total_marks,pass_percentage } = req.body;

     
    if (!course_id || !module_id ) {
        return res.status(400).json({
            statusCode: 400,
            message: "Bad Request: Missing required fields"
        });
    }

    try {
        // Check course exists
        const existCourse = await pool.query(
            `SELECT course_id FROM tbl_course WHERE course_id=$1`,
            [course_id]
        );

        if (existCourse.rows.length === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: "Course Not Found"
            });
        }

        // Insert into tbl_assignment
        const assignmentRes = await pool.query(
            `INSERT INTO tbl_assignment (course_id, module_id, assignment_title,assignment_type,total_questions,total_marks,pass_percentage)
             VALUES ($1, $2, $3,$4,$5,$6,$7) 
             RETURNING assignment_id`,
            [course_id, module_id, assignment_title,assignment_type,total_questions,total_marks,pass_percentage]
        );

    

        return res.status(200).json({
            statusCode: 200,
            message: "Assignment and questions added successfully",
            assignment:assignmentRes.rows[0]
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            statusCode: 500,
            message: "Internal Server Error"
        });
    }
};

exports.updateAssignment = async (req, res) => {
    const { assignment_id } = req.body;
    const {
        course_id,
        module_id,
        assignment_title,
        assignment_type,
        total_questions,
        total_marks,
        pass_percentage
    } = req.body;

    if (!assignment_id) {
        return res.status(400).json({
            statusCode: 400,
            message: "Bad Request: assignment_id is required"
        });
    }

    try {
        // Check assignment exists
        const existAssign = await pool.query(
            `SELECT assignment_id FROM tbl_assignment WHERE assignment_id=$1`,
            [assignment_id]
        );

        if (existAssign.rows.length === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: "Assignment Not Found"
            });
        }

        // If course_id provided check course exists
        if (course_id) {
            const existCourse = await pool.query(
                `SELECT course_id FROM tbl_course WHERE course_id=$1`,
                [course_id]
            );

            if (existCourse.rows.length === 0) {
                return res.status(404).json({
                    statusCode: 404,
                    message: "Course Not Found"
                });
            }
        }

        // UPDATE Query
        const updateQuery = `
            UPDATE tbl_assignment 
            SET
                course_id = COALESCE($1, course_id),
                module_id = COALESCE($2, module_id),
                assignment_title = COALESCE($3, assignment_title),
                assignment_type = COALESCE($4, assignment_type),
                total_questions = COALESCE($5, total_questions),
                total_marks = COALESCE($6, total_marks),
                pass_percentage = COALESCE($7, pass_percentage)
            WHERE assignment_id = $8
            RETURNING *;
        `;

        const updateRes = await pool.query(updateQuery, [
            course_id,
            module_id,
            assignment_title,
            assignment_type,
            total_questions,
            total_marks,
            pass_percentage,
            assignment_id
        ]);

        return res.status(200).json({
            statusCode: 200,
            message: "Assignment updated successfully",
            updated_assignment: updateRes.rows[0]
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            statusCode: 500,
            message: "Internal Server Error"
        });
    }
};


// exports.addassignmentquestion = async (req, res) => {
//     const { assignment_id, questions } = req.body;

//     if (!assignment_id || !questions || !Array.isArray(questions)) {
//         return res.status(400).json({
//             statusCode: 400,
//             message: "Bad Request: assignment_id and questions are required"
//         });
//     }

//     try {
//         // Get assignment + total question count
//         const existAssign = await pool.query(
//             `SELECT assignment_id, total_questions 
//              FROM tbl_assignment 
//              WHERE assignment_id = $1`,
//             [assignment_id]
//         );

//         if (existAssign.rows.length === 0) {
//             return res.status(404).json({
//                 statusCode: 404,
//                 message: "Assignment Not Found"
//             });
//         }

//         const totalAllowed = existAssign.rows[0].total_questions;
//         const incomingCount = questions.length;

//         // Strict total match check
//         if (incomingCount !== totalAllowed) {
//             return res.status(400).json({
//                 statusCode: 400,
//                 message: `You must add exactly ${totalAllowed} questions. You sent ${incomingCount}. Nothing was added.`
//             });
//         }

//         // Insert question only when count matches
//         for (const q of questions) {
//             await pool.query(
//                 `INSERT INTO tbl_questions 
//                 (question, a, b, c, d, answer, assignment_id)
//                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
//                 [
//                     q.question,
//                     q.a,
//                     q.b,
//                     q.c,
//                     q.d,
//                     q.answer,
//                     assignment_id
//                 ]
//             );
//         }

//         return res.status(200).json({
//             statusCode: 200,
//             message: "Questions added successfully",
//             added: incomingCount
//         });

//     } catch (error) {
//         console.log(error);
//         return res.status(500).json({
//             statusCode: 500,
//             message: "Internal Server Error"
//         });
//     }
// };


exports.addassignmentquestion = async (req, res) => {
    const { assignment_id, questions } = req.body;

    if (!assignment_id || !questions || !Array.isArray(questions)) {
        return res.status(400).json({
            statusCode: 400,
            message: "Bad Request: assignment_id and questions are required"
        });
    }

    try {
        // Get assignment + total question count
        const existAssign = await pool.query(
            `SELECT assignment_id, total_questions 
             FROM tbl_assignment 
             WHERE assignment_id = $1`,
            [assignment_id]
        );

        if (existAssign.rows.length === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: "Assignment Not Found"
            });
        }

        const totalAllowed = existAssign.rows[0].total_questions;
        const incomingCount = questions.length;
        console.log('totalAllowd', totalAllowed);

        // Strict total match check
        if (incomingCount !== totalAllowed) {
            return res.status(400).json({
                statusCode: 400,
                message: `You must add exactly ${totalAllowed} questions. You sent ${incomingCount}. Nothing was added.`
            });
        }
        const assignmentStatus = questions[0].status;
        // Insert question only when count matches
        for (const q of questions) {
            await pool.query(
                `INSERT INTO tbl_questions 
                (question, a, b, c, d, answer, status,assignment_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7,$8)`,
                [
                    q.question,
                    q.a,
                    q.b,
                    q.c,
                    q.d,
                    q.answer,
                    q.status,
                    assignment_id
                ]
            );
        }

        await pool.query(
            `UPDATE tbl_assignment 
             SET status = $1 
             WHERE assignment_id = $2`,
            [assignmentStatus, assignment_id]
        );
        return res.status(200).json({
            statusCode: 200,
            message: "Questions added successfully",
            added: incomingCount
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            statusCode: 500,
            message: "Internal Server Error"
        });
    }
};


exports.getAssignmentById = async (req, res) => {
    const { assignment_id } = req.body;

    try {
        // Check assignment exists
        const assignmentData = await pool.query(
            `SELECT * FROM tbl_assignment WHERE assignment_id = $1`,
            [assignment_id]
        );

        if (assignmentData.rows.length === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: "Assignment Not Found"
            });
        }

        const assignment = assignmentData.rows[0];

        // Fetch questions belonging to this assignment
        const questionData = await pool.query(
            `SELECT question_id, question, a, b, c, d, answer 
             FROM tbl_questions 
             WHERE assignment_id = $1`,
            [assignment_id]
        );

        const questions = questionData.rows;

        return res.status(200).json({
            statusCode: 200,
            message: "Assignment fetched successfully",
            assignment: {
                assignment_id: assignment.assignment_id,
                course_id: assignment.course_id,
                module_id: assignment.module_id,
                assignment_description: assignment.assignment_description,
                questions: questions
            }
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            statusCode: 500,
            message: "Internal Server Error"
        });
    }
};


exports.getAssignments= async (req, res) => {
   
    try {
         const assignmentData = await pool.query(
            `SELECT * FROM tbl_assignment`,
         
        );
       const assignment = assignmentData.rows[0];
        
       const questionData = await pool.query(
            `SELECT question_id, question, a, b, c, d, answer 
             FROM tbl_questions 
           ` );

        const questions = questionData.rows;

        return res.status(200).json({
            statusCode: 200,
            message: "Assignment fetched successfully",
            assignment: {
                assignment_id: assignment.assignment_id,
                course_id: assignment.course_id,
                module_id: assignment.module_id,
                assignment_description: assignment.assignment_description,
                questions: questions
            }
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            statusCode: 500,
            message: "Internal Server Error"
        });
    }
};
 

exports.getassignmentsdetails=async(req,res)=>{
    const {assignment_id} =req.body
    if(!assignment_id){
        return res.status(400).json({
            statusCode:401,
            message:'Missing Require Field'
        })
    }
    try{
        const exitassigment=await pool.query(`SELECT assignment_id FROM  tbl_assignment WHERE assignment_id=$1`,[assignment_id]);
        if(exitassigment.rows.length === 0){
            return res.status(404).json({
                statusCode:404,
                message:'Not Found'
            })
        }
        const result=await pool.query(`SELECT * FROM tbl_assignment WHERE assignment_id=$1`,[assignment_id]);
        return res.status(200).json({
            statusCode:200,
            message:'Fetched Sucessfully',
            assignement :result.rows[0]
        })
    }catch(error){
        return res.status(500).json({
            statusCode:500,
            message:'Internal Server Error'
        })
    }
}


exports.getTutorAssignmentDetails = async (req, res) => {
  const { tutorId } = req.body;

  try {
     const query = `
      SELECT
        c.course_id,
        c.course_title,
        m.module_id,
        m.module_title,
        a.assignment_id,
        a.assignment_title,
        a.assignment_type,
        a.total_marks,
        a.pass_percentage,
        a.status,
        a.assignment_date,
        COUNT(q.question_id) AS total_questions
      FROM tbl_course c
      JOIN tbl_module m ON m.course_id = c.course_id
      JOIN tbl_assignment a ON a.module_id = m.module_id
      LEFT JOIN tbl_questions q ON q.assignment_id = a.assignment_id
      WHERE c.tutor_id = $1
      GROUP BY
        c.course_id,
        c.course_title,
        m.module_id,
        m.module_title,
        a.assignment_id
      ORDER BY c.course_id, m.module_id, a.assignment_id
    `;
    const result = await pool.query(query, [tutorId]);

    const courseMap = {};

    result.rows.forEach(row => {
      // COURSE LEVEL
      if (!courseMap[row.course_id]) {
        courseMap[row.course_id] = {
          course_id: row.course_id,
          course_title: row.course_title,
          assignment_date: row.assignment_date, // ✅ keep as you said
          status:row.status,
          total_modules: new Set(),        // for counting
          total_assignments: 0,
          total_questions: 0,
          assignment_type: row.assignment_type,
          pass_percentage: row.pass_percentage,

          modules: []
        };
      }

      const course = courseMap[row.course_id];

      // count assignments
      course.total_assignments += 1;

      // add questions
      course.total_questions += Number(row.total_questions);

      // MODULE LEVEL
      let module = course.modules.find(m => m.module_id === row.module_id);
      if (!module) {
        module = {
          module_id: row.module_id,
          module_title: row.module_title,
          assignments: []
        };
        course.modules.push(module);

        // count unique modules
        course.total_modules.add(row.module_id);
      }

      // ASSIGNMENT LEVEL
      module.assignments.push({
        assignment_id: row.assignment_id,
        assignment_title: row.assignment_title,
        assignment_type: row.assignment_type,
        total_questions: Number(row.total_questions),
        total_marks: row.total_marks,
        pass_percentage: row.pass_percentage,
     
        assignment_date: row.assignment_date
      });
    });

    // convert Set → number
    const finalData = Object.values(courseMap).map(course => ({
      ...course,
      total_modules: course.total_modules.size
    }));

    res.status(200).json({
      statusCode:200,
      message:'Fectched Sucessfully',
      data: finalData
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "Server error"
    });
  }
};