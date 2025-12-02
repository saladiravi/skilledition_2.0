const pool = require('../config/db');

exports.addcategory = async (req, res) => {

    const { category_name } = req.body
    if (!category_name) {
        return res.status(400).json({
            statusCode: 400,
            message: 'missing required field'
        })
    }
    try {
        const result = await pool.query(`INSERT INTO tbl_category (category_name) VALUES($1) RETURNING *`, [category_name]);

        return res.status(200).json({
            statusCode: 200,
            message: 'Category added Sucessfully',
            category: result.rows[0]
        })
    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            message: 'Internal Server Error'
        })
    }
}


exports.getcategory = async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM tbl_category`);
        return res.status(200).json({
            statusCode: 200,
            message: 'Categories Fetched Sucessfully',
            category: result.rows
        })
    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            message: 'Internal Server Error'
        })
    }
}



exports.getcategorybyid = async (req, res) => {
    const { category_id } = req.body
    if (!category_id) {
        return res.status(400).json({
            statusCode: 400,
            message: 'missing required filed'
        })
    }

    try {
        const exitcategory = await pool.query(`SELECT * FROM tbl_category WHERE category_id=$1`, [category_id]);
        if (exitcategory.rows.length === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: 'category Not Found '
            })
        }

        const result = await pool.query(`SELECT * FROM tbl_category WHERE category_id=$1`, [category_id]);
        return res.status(200).json({
            statusCode: 200,
            message: 'Fetched Sucessfully',
            category: result.rows[0]
        })
    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            message: 'Internal Server Error'
        })
    }
}


exports.delcategory = async (req, res) => {
    const { category_id } = req.body
    if (!category_id) {
        return res.status(400).json({
            statusCode: 400,
            message: 'Missing Required Field'
        })
    }

    try {
        const exitcatg = await pool.query(`SELECT category_id FROM tbl_category WHERE category_id=$1`, [category_id]);
        
        if (exitcatg.rows.length === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: 'category Not Found'
            })
        }

        const result = await pool.query(`DELETE FROM tbl_category WHERE category_id=$1`, [category_id]);
        return res.status(200).json({
            statusCode: 200,
            message: 'Delete category Sucessfully',

        })

    } catch (error) {
        console.log(error)
        return res.status(500).json({
            statusCode: 500,
            message: 'Internal Server Error'
        })
    }
}


exports.updatecategory = async (req, res) => {
    const { category_id, category_name } = req.body;

    if (!category_id || !category_name) {
        return res.status(400).json({
            statusCode: 400,
            message: 'Missing Required Fields'
        });
    }

    try {
        // Check if category exists
        const existingCategory = await pool.query(
            `SELECT * FROM tbl_category WHERE category_id = $1`,
            [category_id]
        );

        if (existingCategory.rows.length === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: 'Category Not Found'
            });
        }

        // Update category
        const updated = await pool.query(
            `UPDATE tbl_category SET category_name = $1 WHERE category_id = $2 RETURNING *`,
            [category_name, category_id]  // <-- Correct order
        );

        return res.status(200).json({
            statusCode: 200,
            message: 'Updated Successfully',
            category: updated.rows[0]
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            statusCode: 500,
            message: 'Internal Server Error'
        });
    }
};
