const pool = require("../config/db");

exports.createAssessment = async (req, res) => {
  const {
    title,
    description,
    instructions,
    total_questions = 45,
    total_duration_minutes = 45,
    total_marks = 45,
    max_attempts = 1,
    starts_at,
    ends_at,
    status = "DRAFT",
  } = req.body || {};

  try {
    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof instructions !== "string" ||
      !instructions.trim()
    ) {
      return res.status(400).json({
        statusCode: 400,
        message: "Title and instructions are required",
      });
    }

    if (
      !Number.isInteger(total_questions) ||
      total_questions <= 0 ||
      !Number.isInteger(total_duration_minutes) ||
      total_duration_minutes <= 0 ||
      !Number.isInteger(total_marks) ||
      total_marks <= 0 ||
      !Number.isInteger(max_attempts) ||
      max_attempts <= 0
    ) {
      return res.status(400).json({
        statusCode: 400,
        message: "Assessment counts, duration, marks, and attempts must be positive integers",
      });
    }

    if (!["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
      return res.status(400).json({
        statusCode: 400,
        message: "Invalid assessment status",
      });
    }

    if (
      starts_at &&
      ends_at &&
      new Date(ends_at).getTime() <= new Date(starts_at).getTime()
    ) {
      return res.status(400).json({
        statusCode: 400,
        message: "End date must be later than start date",
      });
    }

    const existingAssessment = await pool.query(
      `SELECT assessment_id
      FROM tbl_internship_assessments
      WHERE LOWER(TRIM(title)) = LOWER(TRIM($1))
      LIMIT 1`,
      [title.trim()]
    );

    if (existingAssessment.rowCount > 0) {
      return res.status(409).json({
        success: false,
        statusCode: 409,
        message: "An assessment with this title already exists",
      });
    }

    const result = await pool.query(
      `INSERT INTO tbl_internship_assessments (
        title,
        description,
        instructions,
        total_questions,
        total_duration_minutes,
        total_marks,
        max_attempts,
        starts_at,
        ends_at,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        title.trim(),
        description?.trim() || null,
        instructions.trim(),
        total_questions,
        total_duration_minutes,
        total_marks,
        max_attempts,
        starts_at || null,
        ends_at || null,
        status,
      ],
    );

    return res.status(201).json({
      success: true,
      statusCode: 201,
      message: "Assessment created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create assessment error:", error);

    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
};

exports.createAssessmentSection = async (req, res) => {
  const {
    assessment_id,
    section_name,
    section_type,
    question_count,
    duration_minutes,
    marks_per_question = 1,
    negative_marks = 0,
    display_order,
  } = req.body || {};

  try {
    if (
      !Number.isInteger(assessment_id) ||
      assessment_id <= 0 ||
      typeof section_name !== "string" ||
      !section_name.trim() ||
      !Number.isInteger(question_count) ||
      question_count <= 0 ||
      !Number.isInteger(duration_minutes) ||
      duration_minutes <= 0 ||
      !Number.isInteger(display_order) ||
      display_order <= 0
    ) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid assessment ID, section name, question count, duration, and display order are required",
      });
    }

    if (!["APTITUDE", "TECHNICAL"].includes(section_type)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Section type must be APTITUDE or TECHNICAL",
      });
    }

    if (
      typeof marks_per_question !== "number" ||
      !Number.isFinite(marks_per_question) ||
      marks_per_question <= 0 ||
      typeof negative_marks !== "number" ||
      !Number.isFinite(negative_marks) ||
      negative_marks < 0
    ) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Marks per question must be positive and negative marks cannot be negative",
      });
    }

    const assessmentResult = await pool.query(
      `SELECT assessment_id
       FROM tbl_internship_assessments
       WHERE assessment_id = $1`,
      [assessment_id]
    );

    if (assessmentResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: `Assessment with ID ${assessment_id} not found`,
      });
    }

    const existingSection = await pool.query(
      `SELECT section_id
       FROM tbl_internship_assessment_sections
       WHERE assessment_id = $1
         AND (LOWER(section_name) = LOWER($2) OR section_type = $3 OR display_order = $4)
       LIMIT 1`,
      [assessment_id, section_name.trim(), section_type, display_order]
    );

    if (existingSection.rowCount > 0) {
      return res.status(409).json({
        success: false,
        statusCode: 409,
        message: "A section with the same name, type, or display order already exists for this assessment",
      });
    }

    const result = await pool.query(
      `INSERT INTO tbl_internship_assessment_sections (
        assessment_id,
        section_name,
        section_type,
        question_count,
        duration_minutes,
        marks_per_question,
        negative_marks,
        display_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        assessment_id,
        section_name.trim(),
        section_type,
        question_count,
        duration_minutes,
        marks_per_question,
        negative_marks,
        display_order,
      ]
    );

    return res.status(201).json({
      success: true,
      statusCode: 201,
      message: "Assessment section created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create assessment section error:", error);

    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
};

exports.createMultipleQuestions = async (req, res) => {
  const { section_id } = req.params;
  const { questions } = req.body || {};

  try {
    if (!/^[1-9]\d*$/.test(section_id)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid section ID is required",
      });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "At least one question is required",
      });
    }

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];

      if (
        !question ||
        typeof question !== "object" ||
        Array.isArray(question) ||
        typeof question.topic !== "string" ||
        !question.topic.trim() ||
        typeof question.question_text !== "string" ||
        !question.question_text.trim() ||
        !["option_a", "option_b", "option_c", "option_d"].every(
          (option) =>
            typeof question[option] === "string" &&
            question[option].trim()
        )
      ) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: `Valid topic, question text, and all four options are required for question ${i + 1}`,
        });
      }

      if (!["A", "B", "C", "D"].includes(question.correct_option)) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: `Correct option must be A, B, C, or D for question ${i + 1}`,
        });
      }

      if (
        question.difficulty !== undefined &&
        question.difficulty !== null &&
        !["EASY", "MEDIUM", "HARD"].includes(question.difficulty)
      ) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: `Invalid difficulty for question ${i + 1}`,
        });
      }
    }

    const sectionResult = await pool.query(
      `SELECT section_id
       FROM tbl_internship_assessment_sections
       WHERE section_id = $1`,
      [Number(section_id)]
    );

    if (sectionResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: `Assessment section with ID ${section_id} not found`,
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const insertedQuestions = [];
      let skippedQuestions = 0;

      for (const question of questions) {
        const result = await client.query(
          `INSERT INTO tbl_internship_question_bank (
            section_id,
            topic,
            question_text,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_option,
            difficulty
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (section_id, (LOWER(TRIM(question_text))))
          DO NOTHING
          RETURNING
            question_id,
            section_id,
            topic,
            question_text,
            option_a,
            option_b,
            option_c,
            option_d,
            difficulty,
            is_active,
            created_at`,
          [
            Number(section_id),
            question.topic.trim(),
            question.question_text.trim(),
            question.option_a.trim(),
            question.option_b.trim(),
            question.option_c.trim(),
            question.option_d.trim(),
            question.correct_option,
            question.difficulty || "MEDIUM",
          ]
        );

        if (result.rowCount > 0) {
          insertedQuestions.push(result.rows[0]);
        } else {
          skippedQuestions++;
        }
      }

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        statusCode: 201,
        message: "Questions processed successfully",
        data: {
          inserted_count: insertedQuestions.length,
          skipped_count: skippedQuestions,
          questions: insertedQuestions,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Create multiple questions error:", error);

    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
};

exports.getTodayAssessments = async (req, res) => {
  const studentId = req.user?.student_id;

  try {
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Authenticated student ID is required",
      });
    }

    const studentResult = await pool.query(
      `SELECT
         student_id,
         full_name,
         email,
         phone,
         college_name,
         specialization,
         college_id,
         current_year,
         graduation_year
       FROM tbl_internship_students
       WHERE student_id = $1`,
      [studentId]
    );

    if (studentResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Student not found",
      });
    }

    const assessmentQuery = `
      SELECT
        a.assessment_id,
        a.title,
        a.total_questions,
        a.total_duration_minutes,
        a.total_marks,
        a.qualification_percentage,
        a.starts_at,
        a.ends_at,
        COALESCE(attempt.status, 'NOT_STARTED') AS attempt_status,
        attempt.attempt_id,
        attempt.started_at,
        attempt.submitted_at,
        attempt.total_marks AS marks_obtained,
        attempt.correct_answers,
        attempt.incorrect_answers,
        attempt.answered_answers,
        attempt.unanswered_answers,
        attempt.percentage,
        attempt.aptitude_score,
        attempt.technical_score,
        attempt.section_results,
        attempt.time_spent_minutes,
        attempt.is_qualified,
        CASE
          WHEN attempt.status = 'SUBMITTED' THEN TRUE
          ELSE FALSE
        END AS has_completed,
        CASE
          WHEN attempt.status IN ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED')
          THEN TRUE
          ELSE FALSE
        END AS has_started,
        CASE
          WHEN attempt.status = 'SUBMITTED' THEN 'COMPLETED'
          WHEN attempt.status = 'IN_PROGRESS' THEN 'IN_PROGRESS'
          WHEN attempt.status = 'EXPIRED' THEN 'EXPIRED'
          ELSE 'NOT_STARTED'
        END AS student_exam_status
      FROM tbl_internship_assessments a
      LEFT JOIN tbl_internship_assessment_attempts attempt
        ON attempt.assessment_id = a.assessment_id
       AND attempt.student_id = $1
      WHERE a.status = 'PUBLISHED'
        AND a.starts_at::date <= CURRENT_DATE
        AND a.ends_at::date >= CURRENT_DATE
      ORDER BY a.starts_at ASC
    `;

    const previousExamQuery = `
      SELECT
        a.assessment_id,
        a.title,
        a.total_questions,
        a.total_duration_minutes,
        a.total_marks,
        a.qualification_percentage,
        a.starts_at,
        a.ends_at,
        attempt.status AS attempt_status,
        attempt.attempt_id,
        attempt.started_at,
        attempt.submitted_at,
        attempt.total_marks AS marks_obtained,
        attempt.correct_answers,
        attempt.incorrect_answers,
        attempt.answered_answers,
        attempt.unanswered_answers,
        attempt.percentage,
        attempt.aptitude_score,
        attempt.technical_score,
        attempt.time_spent_minutes,
        attempt.is_qualified,
        CASE
          WHEN attempt.status = 'SUBMITTED' THEN TRUE
          ELSE FALSE
        END AS has_completed,
        CASE
          WHEN attempt.status IN ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED')
          THEN TRUE
          ELSE FALSE
        END AS has_started,
        CASE
          WHEN attempt.status = 'SUBMITTED' THEN 'COMPLETED'
          WHEN attempt.status = 'IN_PROGRESS' THEN 'IN_PROGRESS'
          WHEN attempt.status = 'EXPIRED' THEN 'EXPIRED'
          ELSE 'NOT_STARTED'
        END AS student_exam_status
      FROM tbl_internship_assessments a
      INNER JOIN tbl_internship_assessment_attempts attempt
        ON attempt.assessment_id = a.assessment_id
      AND attempt.student_id = $1
      WHERE a.status = 'PUBLISHED'
        AND a.ends_at::date < CURRENT_DATE
      ORDER BY a.starts_at DESC
    `;

    const [assessmentResult, previousExamResult] = await Promise.all([
      pool.query(assessmentQuery, [studentId]),
      pool.query(previousExamQuery, [studentId]),
    ]);

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Assessments retrieved successfully",
      data: {
        student: studentResult.rows[0],
        exam_date: new Date().toISOString().slice(0, 10),
        today_assessments: assessmentResult.rows,
        previous_exams: previousExamResult.rows,
      },
    });
  } catch (error) {
    console.error("Get today's assessments error:", error);

    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
};

exports.startAssessment = async (req, res) => {
  const { assessment_id } = req.params;
  const studentId = req.user?.student_id;

  try {
    if (!/^[1-9]\d*$/.test(assessment_id || "")) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid assessment ID is required",
      });
    }

    if (!Number.isInteger(studentId) || studentId <= 0) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Authenticated student ID is required",
      });
    }

    const assessmentResult = await pool.query(
      `SELECT
         assessment_id,
         title,
         total_questions,
         total_duration_minutes,
         total_marks,
         starts_at,
         ends_at,
         CURRENT_TIMESTAMP AS current_time
       FROM tbl_internship_assessments
       WHERE assessment_id = $1
         AND status = 'PUBLISHED'`,
      [Number(assessment_id)]
    );

    if (assessmentResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Published assessment not found",
      });
    }

    const assessment = assessmentResult.rows[0];

    if (new Date(assessment.current_time) < new Date(assessment.starts_at)) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: "Assessment has not started yet",
      });
    }

    if (new Date(assessment.current_time) >= new Date(assessment.ends_at)) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: "Assessment has ended",
      });
    }

    const attemptResult = await pool.query(
      `SELECT attempt_id, student_id, assessment_id, status, started_at
       FROM tbl_internship_assessment_attempts
       WHERE student_id = $1
         AND assessment_id = $2`,
      [studentId, Number(assessment_id)]
    );

    let attempt;

    if (attemptResult.rowCount > 0) {
      attempt = attemptResult.rows[0];

      if (attempt.status !== "IN_PROGRESS") {
        return res.status(409).json({
          success: false,
          statusCode: 409,
          message: "You have already attempted this assessment",
        });
      }
    }

    const questionsResult = await pool.query(
      `SELECT
         s.section_id,
         s.section_name,
         s.section_type,
         q.question_id,
         q.topic,
         q.question_text,
         q.option_a,
         q.option_b,
         q.option_c,
         q.option_d,
         q.difficulty
       FROM tbl_internship_assessment_sections s
       CROSS JOIN LATERAL (
         SELECT
           question_id,
           topic,
           question_text,
           option_a,
           option_b,
           option_c,
           option_d,
           difficulty
         FROM tbl_internship_question_bank
         WHERE section_id = s.section_id
           AND is_active = TRUE
         ORDER BY RANDOM()
         LIMIT CASE
           WHEN s.section_type = 'APTITUDE' THEN 15
           WHEN s.section_type = 'TECHNICAL' THEN 30
         END
       ) q
       WHERE s.assessment_id = $1
         AND s.section_type IN ('APTITUDE', 'TECHNICAL')
       ORDER BY s.display_order, RANDOM()`,
      [Number(assessment_id)]
    );

    const aptitudeQuestions = questionsResult.rows.filter(
      (question) => question.section_type === "APTITUDE"
    );

    const technicalQuestions = questionsResult.rows.filter(
      (question) => question.section_type === "TECHNICAL"
    );

    if (
      aptitudeQuestions.length !== 15 ||
      technicalQuestions.length !== 30
    ) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "The assessment does not have enough active questions",
        data: {
          aptitude_available: aptitudeQuestions.length,
          aptitude_required: 15,
          technical_available: technicalQuestions.length,
          technical_required: 30,
        },
      });
    }

    if (!attempt) {
      const result = await pool.query(
        `INSERT INTO tbl_internship_assessment_attempts (
           student_id,
           assessment_id,
           status,
           started_at
         )
         VALUES ($1, $2, 'IN_PROGRESS', CURRENT_TIMESTAMP)
         RETURNING attempt_id, student_id, assessment_id, status, started_at`,
        [studentId, Number(assessment_id)]
      );

      attempt = result.rows[0];
    }

    return res.status(attemptResult.rowCount > 0 ? 200 : 201).json({
      success: true,
      statusCode: attemptResult.rowCount > 0 ? 200 : 201,
      message:
        attemptResult.rowCount > 0
          ? "Assessment resumed successfully"
          : "Assessment started successfully",
      data: {
        attempt,
        assessment,
        total_questions: 45,
        sections: [
          {
            section_name: "Aptitude",
            section_type: "APTITUDE",
            question_count: aptitudeQuestions.length,
            questions: aptitudeQuestions,
          },
          {
            section_name: "Technical",
            section_type: "TECHNICAL",
            question_count: technicalQuestions.length,
            questions: technicalQuestions,
          },
        ],
      },
    });
  } catch (error) {
    console.error("Start assessment error:", error);

    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
};


exports.submitAssessmentAnswers = async (req, res) => {
  const { assessment_id } = req.params;
  const { answers } = req.body || {};
  const studentId = req.user?.student_id;

  let client;

  try {
    if (!/^[1-9]\d*$/.test(assessment_id || "")) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid assessment ID is required",
      });
    }

    const assessmentId = Number(assessment_id);

    if (!Number.isSafeInteger(assessmentId)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid assessment ID is required",
      });
    }

    if (!Number.isSafeInteger(studentId) || studentId <= 0) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Authenticated student ID is required",
      });
    }

    if (!Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Answers must be an array",
      });
    }

    const submittedQuestionIds = new Set();

    for (let i = 0; i < answers.length; i++) {
      const answer = answers[i];

      if (
        !answer ||
        !Number.isSafeInteger(answer.question_id) ||
        answer.question_id <= 0 ||
        !["A", "B", "C", "D"].includes(answer.selected_option)
      ) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: `Valid question ID and selected option are required for answer ${i + 1}`,
        });
      }

      if (submittedQuestionIds.has(answer.question_id)) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: `Duplicate question ID ${answer.question_id} found in submitted answers`,
        });
      }

      submittedQuestionIds.add(answer.question_id);
    }

    client = await pool.connect();

    try {
      await client.query("BEGIN");

      const assessmentResult = await client.query(
        `SELECT
           assessment_id,
           total_questions,
           total_marks,
           qualification_percentage
         FROM tbl_internship_assessments
         WHERE assessment_id = $1
         FOR SHARE`,
        [assessmentId]
      );

      if (assessmentResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: `Assessment with ID ${assessmentId} not found`,
        });
      }

      const assessment = assessmentResult.rows[0];
      const totalQuestions = Number(assessment.total_questions);
      const maximumMarks = Number(assessment.total_marks);

      const attemptResult = await client.query(
        `SELECT attempt_id, status, started_at
         FROM tbl_internship_assessment_attempts
         WHERE student_id = $1
           AND assessment_id = $2
         FOR UPDATE`,
        [studentId, assessmentId]
      );

      if (attemptResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: "Please start the assessment before submitting answers",
        });
      }

      const attempt = attemptResult.rows[0];

      if (attempt.status === "SUBMITTED") {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          statusCode: 409,
          message: "You have already submitted this assessment",
        });
      }

      if (attempt.status !== "IN_PROGRESS") {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          statusCode: 409,
          message: "This assessment attempt cannot be submitted",
        });
      }

      if (answers.length > totalQuestions) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: "Submitted answers exceed the total question count",
        });
      }

      const sectionResult = await client.query(
        `SELECT
           section_id,
           section_type,
           question_count,
           marks_per_question,
           negative_marks
         FROM tbl_internship_assessment_sections
         WHERE assessment_id = $1`,
        [assessmentId]
      );

      const sections = {};
      let configuredQuestionCount = 0;

      for (const section of sectionResult.rows) {
        const sectionQuestionCount = Number(section.question_count);
        const marksPerQuestion = Number(section.marks_per_question);

        if (
          !Number.isSafeInteger(sectionQuestionCount) ||
          sectionQuestionCount < 0 ||
          !Number.isFinite(marksPerQuestion) ||
          marksPerQuestion < 0
        ) {
          throw new Error("Invalid assessment section configuration");
        }

        configuredQuestionCount += sectionQuestionCount;

        sections[section.section_id] = {
          section_id: Number(section.section_id),
          section_type: section.section_type,
          section_name:
            section.section_type === "APTITUDE"
              ? "Aptitude Test"
              : section.section_type === "TECHNICAL"
                ? "Technical MCQ Test"
                : section.section_type,
          total_questions: sectionQuestionCount,
          attempted_questions: 0,
          answered_questions: 0,
          unanswered_questions: sectionQuestionCount,
          correct_answers: 0,
          incorrect_answers: 0,
          total_marks: 0,
          maximum_marks: sectionQuestionCount * marksPerQuestion,
          percentage: 0,
        };
      }

      if (configuredQuestionCount !== totalQuestions) {
        await client.query("ROLLBACK");

        return res.status(500).json({
          success: false,
          statusCode: 500,
          message:
            "Assessment question count does not match its section configuration",
        });
      }

      const questionIds = answers.map((answer) => answer.question_id);

      let questionsResult = { rows: [], rowCount: 0 };

      if (questionIds.length > 0) {
        questionsResult = await client.query(
          `SELECT
             q.question_id,
             q.correct_option,
             s.section_id,
             s.section_type,
             s.marks_per_question,
             s.negative_marks
           FROM tbl_internship_question_bank q
           JOIN tbl_internship_assessment_sections s
             ON s.section_id = q.section_id
           WHERE s.assessment_id = $1
             AND q.question_id = ANY($2::int[])
             AND q.is_active = TRUE`,
          [assessmentId, questionIds]
        );
      }

      if (questionsResult.rowCount !== answers.length) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: "One or more questions are invalid for this assessment",
        });
      }

      const questionMap = new Map(
        questionsResult.rows.map((question) => [
          question.question_id,
          question,
        ])
      );

      const sectionAnswerCounts = {};

      for (const answer of answers) {
        const question = questionMap.get(answer.question_id);
        sectionAnswerCounts[question.section_id] =
          (sectionAnswerCounts[question.section_id] || 0) + 1;
      }

      for (const [sectionId, count] of Object.entries(sectionAnswerCounts)) {
        if (!sections[sectionId] || count > sections[sectionId].total_questions) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            success: false,
            statusCode: 400,
            message:
              "Submitted answers exceed the configured question count for a section",
          });
        }
      }

      let correctCount = 0;
      let incorrectCount = 0;
      let totalMarksObtained = 0;

      const answerRecords = answers.map((answer) => {
        const question = questionMap.get(answer.question_id);
        const isCorrect =
          answer.selected_option === question.correct_option;

        const marksAwarded = isCorrect
          ? Number(question.marks_per_question)
          : -Number(question.negative_marks);

        const section = sections[question.section_id];

        section.attempted_questions++;
        section.answered_questions++;
        section.unanswered_questions--;

        if (isCorrect) {
          correctCount++;
          section.correct_answers++;
        } else {
          incorrectCount++;
          section.incorrect_answers++;
        }

        section.total_marks += marksAwarded;
        totalMarksObtained += marksAwarded;

        return {
          question_id: answer.question_id,
          selected_option: answer.selected_option,
          is_correct: isCorrect,
          marks_awarded: marksAwarded,
        };
      });

      if (answerRecords.length > 0) {
        await client.query(
          `INSERT INTO tbl_internship_assessment_answers (
             student_id,
             assessment_id,
             question_id,
             selected_option,
             is_correct,
             marks_awarded
           )
           SELECT
             $1,
             $2,
             a.question_id,
             a.selected_option,
             a.is_correct,
             a.marks_awarded
           FROM jsonb_to_recordset($3::jsonb) AS a(
             question_id INTEGER,
             selected_option VARCHAR(1),
             is_correct BOOLEAN,
             marks_awarded NUMERIC(8, 2)
           )`,
          [
            studentId,
            assessmentId,
            JSON.stringify(answerRecords),
          ]
        );
      }

      const answeredCount = answerRecords.length;
      const unansweredCount = totalQuestions - answeredCount;

      let aptitudeScore = 0;
      let technicalScore = 0;

      const sectionSummaries = Object.values(sections).map((section) => {
        section.section_id = Number(section.section_id);
        section.total_marks = Number(section.total_marks.toFixed(2));

        section.percentage =
          section.maximum_marks > 0
            ? Number(
              Math.max(
                0,
                (section.total_marks / section.maximum_marks) * 100
              ).toFixed(2)
            )
            : 0;

        if (section.section_type === "APTITUDE") {
          aptitudeScore = section.total_marks;
        }

        if (section.section_type === "TECHNICAL") {
          technicalScore = section.total_marks;
        }

        return section;
      });

      const percentage =
        maximumMarks > 0
          ? Number(
            Math.max(
              0,
              (totalMarksObtained / maximumMarks) * 100
            ).toFixed(2)
          )
          : 0;

      const timeResult = await client.query(
        `SELECT GREATEST(
           0,
           FLOOR(
             EXTRACT(
               EPOCH FROM (CURRENT_TIMESTAMP - started_at)
             ) / 60
           )
         )::INTEGER AS time_spent_minutes
         FROM tbl_internship_assessment_attempts
         WHERE attempt_id = $1`,
        [attempt.attempt_id]
      );

      const timeSpentMinutes = timeResult.rows[0].time_spent_minutes;

      const isQualified =
        percentage >= Number(assessment.qualification_percentage);

      await client.query(
        `UPDATE tbl_internship_assessment_attempts
        SET status = 'SUBMITTED',
            submitted_at = CURRENT_TIMESTAMP,
            total_marks = $1,
            correct_answers = $2,
            incorrect_answers = $3,
            answered_answers = $4,
            unanswered_answers = $5,
            time_spent_minutes = $6,
            percentage = $7,
            aptitude_score = $8,
            technical_score = $9,
            is_qualified = $10,
            section_results = $11::jsonb
        WHERE attempt_id = $12`,
        [
          Number(totalMarksObtained.toFixed(2)),
          correctCount,
          incorrectCount,
          answeredCount,
          unansweredCount,
          timeSpentMinutes,
          percentage,
          Number(aptitudeScore.toFixed(2)),
          Number(technicalScore.toFixed(2)),
          isQualified,
          JSON.stringify(sectionSummaries),
          attempt.attempt_id,
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        statusCode: 201,
        message: "Assessment submitted and evaluated successfully",
        data: {
          assessment_id: assessmentId,
          overall: {
            total_questions: totalQuestions,
            attempted_questions: answeredCount,
            answered_questions: answeredCount,
            unanswered_questions: unansweredCount,
            correct_answers: correctCount,
            incorrect_answers: incorrectCount,
            total_marks: Number(totalMarksObtained.toFixed(2)),
            maximum_marks: maximumMarks,
            percentage,
          },
          sections: sectionSummaries,
          time_spent_minutes: timeSpentMinutes,
          qualifying_percentage: Number(
            assessment.qualification_percentage
          ),
          is_qualified: isQualified,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Submit assessment answers error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        statusCode: 409,
        message:
          "Answers have already been submitted for one or more questions",
      });
    }

    return res.status(500).json({
      success: false,
      statusCode: 500,
      message:
        "Internal server error while submitting assessment answers",
    });
  }
};



exports.getStudentAssessmentResult = async (req, res) => {
  const { student_id, assessment_id } = req.params;

  try {
    if (!/^[1-9]\d*$/.test(student_id || "")) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid student ID is required",
      });
    }

    if (!/^[1-9]\d*$/.test(assessment_id || "")) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid assessment ID is required",
      });
    }

    const result = await pool.query(
      `SELECT
          s.student_id,
          s.full_name,
          s.email,
          s.phone,
          a.assessment_id,
          a.total_questions,
          att.answered_answers AS attempted_questions,
          a.title AS assessment_title,
          att.*
      FROM tbl_internship_students s
      CROSS JOIN tbl_internship_assessments a
      JOIN tbl_internship_assessment_attempts att
          ON att.student_id = s.student_id
          AND att.assessment_id = a.assessment_id
      WHERE s.student_id = $1
        AND a.assessment_id = $2
      ORDER BY att.attempt_id DESC
      LIMIT 1`,
      [Number(student_id), Number(assessment_id)]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Student or assessment not found",
      });
    }

    const data = result.rows[0];

    if (data.attempt_id === null) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Assessment attempt not found for this student",
      });
    }

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Student assessment result retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("Get student assessment result error:", error);

    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
};

exports.getAssessments = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM tbl_internship_assessments
       ORDER BY assessment_id DESC`
    );

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Assessments retrieved successfully",
      data: result.rows,
    });
  } catch (error) {
    console.error("Get assessments error:", error);

    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
};

exports.getAssessmentSections = async (req, res) => {
  const { assessment_id } = req.params;

  try {
    if (!/^[1-9]\d*$/.test(assessment_id)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid assessment ID is required",
      });
    }

    const assessmentResult = await pool.query(
      `SELECT assessment_id, title
       FROM tbl_internship_assessments
       WHERE assessment_id = $1`,
      [assessment_id]
    );

    if (assessmentResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: `Assessment with ID ${assessment_id} not found`,
      });
    }

    const sectionsResult = await pool.query(
      `SELECT
         section_id,
         assessment_id,
         section_name,
         section_type,
         question_count,
         duration_minutes,
         marks_per_question,
         negative_marks,
         display_order,
         created_at,
         updated_at
       FROM tbl_internship_assessment_sections
       WHERE assessment_id = $1
       ORDER BY display_order ASC`,
      [assessment_id]
    );

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Assessment sections retrieved successfully",
      data: {
        assessment: assessmentResult.rows[0],
        sections: sectionsResult.rows,
      },
    });
  } catch (error) {
    console.error("Get assessment sections error:", error);

    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
};