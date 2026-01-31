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
        const fetchdata = await pool.query(`SELECT * FROM tbl_assignment WHERE assignment_id=$1`, [assignment_id]);

        // Fetch questions belonging to this assignment
        const questionData = await pool.query(
            `SELECT question_id, question, a, b, c, d, answer 
             FROM tbl_questions 
             WHERE assignment_id = $1
             ORDER BY question_id ASC`,
            [assignment_id]
        );

        const questions = questionData.rows;
        console.log(questions, 'questions');

        return res.status(200).json({
            statusCode: 200,
            message: "Assignment fetched successfully",
            assignment: {
                assignment_id: assignment.assignment_id,
                assignment_title:assignment.assignment_title,
                assignment_type:assignment.assignment_type,
                total_questions:assignment.total_questions,
                total_marks:assignment.total_marks,
                pass_percentage:assignment.pass_percentage,
                reason:assignment.reason,
                status:assignment.status,
                assignment_date:assignment.assignment_date,
            
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
          course_total_marks: 0,
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
        course.course_total_marks += Number(row.total_marks || 0);
      // MODULE LEVEL
      let module = course.modules.find(m => m.module_id === row.module_id);
      if (!module) {
        module = {
          module_id: row.module_id,
          module_title: row.module_title,
           module_total_marks: 0,
             status:row.status,
          assignments: []
        };
        course.modules.push(module);

        // count unique modules
        course.total_modules.add(row.module_id);
      }
        module.module_total_marks += Number(row.total_marks || 0); // ✅
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


// exports.addAssignmentWithQuestions = async (req, res) => {
//   const {
//     course_id,
//     module_id,
//     assignment_title,
//     assignment_type,
//     total_questions,
//     total_marks,
//     pass_percentage,
//     questions // array of questions
//   } = req.body;

//   if (!course_id  || !assignment_title || !total_questions) {
//     return res.status(400).json({
//       statusCode: 400,
//       message: "Missing required fields"
//     });
//   }

//   if (!questions || !Array.isArray(questions)) {
//     return res.status(400).json({
//       statusCode: 400,
//       message: "Questions array is required"
//     });
//   }

//   const client = await pool.connect(); // transaction
//   try {
//     await client.query("BEGIN");

//     // 1️⃣ Check if course exists
//     const existCourse = await client.query(
//       `SELECT course_id FROM tbl_course WHERE course_id=$1`,
//       [course_id]
//     );
//     if (existCourse.rows.length === 0) {
//       await client.query("ROLLBACK");
//       return res.status(404).json({
//         statusCode: 404,
//         message: "Course not found"
//       });
//     }

//     // 2️⃣ Validate total_questions match
//     if (questions.length !== total_questions) {
//       await client.query("ROLLBACK");
//       return res.status(400).json({
//         statusCode: 400,
//         message: `You must add exactly ${total_questions} questions. You sent ${questions.length}.`
//       });
//     }

//     // 3️⃣ Insert assignment
//     const assignmentRes = await client.query(
//       `INSERT INTO tbl_assignment 
//         (course_id, module_id, assignment_title, assignment_type, total_questions, total_marks, pass_percentage)
//        VALUES ($1,$2,$3,$4,$5,$6,$7)
//        RETURNING assignment_id`,
//       [course_id, module_id, assignment_title, assignment_type, total_questions, total_marks, pass_percentage]
//     );

//     const assignment_id = assignmentRes.rows[0].assignment_id;

//     // 4️⃣ Insert questions
//     const assignmentStatus = questions[0].status; // assuming all same status
//     for (const q of questions) {
//       await client.query(
//         `INSERT INTO tbl_questions 
//           (question, a, b, c, d, answer, assignment_id)
//          VALUES ($1,$2,$3,$4,$5,$6,$7)`,
//         [q.question, q.a, q.b, q.c, q.d, q.answer, assignment_id]
//       );
//     }

//     // 5️⃣ Update assignment status


//     await client.query("COMMIT");

//     return res.status(200).json({
//       statusCode: 200,
//       message: "Assignment and questions added successfully",
//       assignment_id,
//       total_questions: questions.length
//     });

//   } catch (error) {
//     await client.query("ROLLBACK");
     
//     return res.status(500).json({
//       statusCode: 500,
//       message: "Internal Server Error"
//     });
//   } finally {
//     client.release();
//   }
// };




exports.addAssignmentWithQuestions = async (req, res) => {
  const {
    course_id,
    module_id,
    assignment_title,
    assignment_type,
    total_questions,
    total_marks,
    pass_percentage,
    questions
  } = req.body;

  // 🔹 Type conversion (VERY IMPORTANT)
  const courseId = Number(course_id);
  const moduleId = module_id ? Number(module_id) : null;
  const totalQuestions = Number(total_questions);
  const totalMarks = total_marks ? Number(total_marks) : null;

  // 🔹 Basic validations
  if (!courseId || !assignment_title || !totalQuestions) {
    return res.status(400).json({
      statusCode: 400,
      message: "Missing or invalid required fields"
    });
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({
      statusCode: 400,
      message: "Questions array is required"
    });
  }

  if (questions.length !== totalQuestions) {
    return res.status(400).json({
      statusCode: 400,
      message: `You must add exactly ${totalQuestions} questions. You sent ${questions.length}.`
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Validate course exists
    const courseCheck = await client.query(
      `SELECT course_id FROM tbl_course WHERE course_id = $1`,
      [courseId]
    );

    if (courseCheck.rows.length === 0) {
      throw new Error("Course not found");
    }

    // 2️⃣ Insert assignment (default status = Pending)
    const assignmentRes = await client.query(
      `INSERT INTO tbl_assignment
       (course_id, module_id, assignment_title, assignment_type,
        total_questions, total_marks, pass_percentage, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Pending')
       RETURNING assignment_id`,
      [
        courseId,
        moduleId,
        assignment_title,
        assignment_type,
        totalQuestions,
        totalMarks,
        pass_percentage
      ]
    );

    const assignment_id = assignmentRes.rows[0].assignment_id;

    // 3️⃣ Insert questions (default status = Pending)
    for (const q of questions) {
      if (!q.question || !q.a || !q.b || !q.c || !q.d || !q.answer) {
        throw new Error("Each question must contain question, options, and answer");
      }

      if (!['a', 'b', 'c', 'd'].includes(q.answer)) {
        throw new Error("Answer must be one of a, b, c, d");
      }

      await client.query(
        `INSERT INTO tbl_questions
         (question, a, b, c, d, answer, assignment_id, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'Pending')`,
        [
          q.question,
          q.a,
          q.b,
          q.c,
          q.d,
          q.answer,
          assignment_id
        ]
      );
    }

    await client.query("COMMIT");

    return res.status(200).json({
      statusCode: 200,
      message: "Assignment and questions added successfully",
      assignment_id,
      total_questions: totalQuestions
    });

  } catch (error) {
    await client.query("ROLLBACK");
  

    return res.status(500).json({
      statusCode: 500,
      message: error.message
    });
  } finally {
    client.release();
  }
};


exports.rejectQuestion = async (req, res) => {
    const { assignment_id, questions } = req.body;

    if (
        !assignment_id ||
        !Array.isArray(questions) ||
        questions.length === 0
    ) {
        return res.status(400).json({
            message: "assignment_id and questions array are required"
        });
    }

    const client = await pool.connect();


    try {
        await client.query("BEGIN");

        // 1️⃣ Reject each question
        for (const q of questions) {
            if (!q.question_id || !q.reason) {
                throw new Error("Each question must have question_id and reason");
            }

            await client.query(
                `UPDATE tbl_questions
         SET status = 'Rejected',
             reason = $1
         WHERE question_id = $2
           AND assignment_id = $3`,
                [q.reason, q.question_id, assignment_id]
            );
        }

        // 2️⃣ Recalculate assignment status
        const statusResult = await client.query(
            `SELECT
         COUNT(*) FILTER (WHERE status = 'Rejected') AS rejected,
         COUNT(*) FILTER (WHERE status = 'Approved') AS approved,
         COUNT(*) AS total
       FROM tbl_questions
       WHERE assignment_id = $1`,
            [assignment_id]
        );

        const { rejected, approved, total } = statusResult.rows[0];

        let assignmentStatus = "Pending";

        if (rejected > 0) {
            assignmentStatus = "Rejected";
        } else if (approved == total) {
            assignmentStatus = "Approved";
        }

        // 3️⃣ Update assignment
        await client.query(
            `UPDATE tbl_assignment
       SET status = $1
       WHERE assignment_id = $2`,
            [assignmentStatus, assignment_id]
        );

        await client.query("COMMIT");

        res.status(200).json({
            message: "Questions rejected successfully",
            assignmentStatus
        });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error.message);

        res.status(500).json({
            message: error.message || "Internal Server Error"
        });
    } finally {
        client.release();
    }
};


exports.getRejectedQuestions = async (req, res) => {
    const { assignment_id } = req.body;

    if (!assignment_id) {
        return res.status(400).json({
            statusCode: 400,
            message: "assignment_id is required"
        });
    }

    try {
        const query = `
            SELECT
                -- Assignment details
                a.assignment_id,
                a.assignment_title,
                a.assignment_type,
                a.total_questions,
                a.total_marks,
                a.pass_percentage,
                a.status AS assignment_status,
                a.assignment_date,

                -- Question details
                q.question_id,
                q.question,
                q.a,
                q.b,
                q.c,
                q.d,
                q.answer,
                q.status AS question_status,
                q.reason AS question_reason
            FROM tbl_assignment a
            LEFT JOIN tbl_questions q
                ON a.assignment_id = q.assignment_id
            WHERE a.assignment_id = $1
              AND q.status = 'Rejected'
        `;

        const result = await pool.query(query, [assignment_id]);

        if (result.rows.length === 0) {
            return res.status(200).json({
                statusCode: 200,
                message: "No rejected questions found for this assignment",
                assignment: null,
                rejectedQuestions: []
            });
        }

        // Assignment details
        const assignment = {
            assignment_id: result.rows[0].assignment_id,
            assignment_title: result.rows[0].assignment_title,
            assignment_type: result.rows[0].assignment_type,
            total_questions: result.rows[0].total_questions,
            total_marks: result.rows[0].total_marks,
            pass_percentage: result.rows[0].pass_percentage,
            status: result.rows[0].assignment_status,
            assignment_date: result.rows[0].assignment_date
        };

        // Rejected questions
        const rejectedQuestions = result.rows.map(row => ({
            question_id: row.question_id,
            question: row.question,
            a: row.a,
            b: row.b,
            c: row.c,
            d: row.d,
            answer: row.answer,
            status: row.question_status,
            reason: row.question_reason
        }));

        res.status(200).json({
            statusCode: 200,
            message: "Fetched Successfully",
            assignment,
            rejectedQuestions
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            statusCode: 500,
            message: "Internal Server Error"
        });
    }
};



exports.updateRejectedQuestions = async (req, res) => {
    const { assignment_id, questions } = req.body;

    if (!assignment_id || !Array.isArray(questions)) {
        return res.status(400).json({
            statusCode: 400,
            message: "assignment_id and questions are required"
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        for (const q of questions) {
            const result = await client.query(
                `UPDATE tbl_questions
         SET question = $1,
             a = $2,
             b = $3,
             c = $4,
             d = $5,
             answer = $6,
             status = 'Pending',
             reason = NULL
         WHERE question_id = $7
           AND assignment_id = $8
           AND status = 'Rejected'`,
                [
                    q.question,
                    q.a,
                    q.b,
                    q.c,
                    q.d,
                    q.answer,
                    q.question_id,
                    assignment_id
                ]
            );

            // ❌ Prevent update if not rejected
            if (result.rowCount === 0) {
                throw new Error(
                    `Question ${q.question_id} is not rejected or cannot be updated`
                );
            }
        }

        // Assignment goes back to Pending
        await client.query(
            `UPDATE tbl_assignment
       SET status = 'Pending'
       WHERE assignment_id = $1`,
            [assignment_id]
        );

        await client.query("COMMIT");

        res.status(200).json({
            statusCode: 200,
            message: "Rejected questions updated and sent for re-approval"
        });

    } catch (error) {
        await client.query("ROLLBACK");


        res.status(400).json({
            statusCode: 400,
            message: error.message
        });
    } finally {
        client.release();
    }
};


exports.deleteAssignmentIfPending = async (req, res) => {
    const { assignment_id } = req.body;

    if (!assignment_id) {
        return res.status(400).json({
            statusCode: 400,
            message: "assignment_id is required"
        });
    }

    try {
        // Check assignment exists and status
        const assignmentResult = await pool.query(
            `SELECT status FROM tbl_assignment WHERE assignment_id = $1`,
            [assignment_id]
        );

        if (assignmentResult.rows.length === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: "Assignment not found"
            });
        }

        if (assignmentResult.rows[0].status !== 'Pending') {
            return res.status(400).json({
                statusCode: 400,
                message: "Only Pending assignments can be deleted"
            });
        }

        // Delete questions first (FK safety)
        await pool.query(
            `DELETE FROM tbl_questions WHERE assignment_id = $1`,
            [assignment_id]
        );

        // Delete assignment
        await pool.query(
            `DELETE FROM tbl_assignment WHERE assignment_id = $1`,
            [assignment_id]
        );

        return res.status(200).json({
            statusCode: 200,
            message: "Assignment deleted successfully"
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            statusCode: 500,
            message: "Internal Server Error"
        });
    }
};