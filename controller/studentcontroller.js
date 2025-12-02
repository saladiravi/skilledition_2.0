const pool=require('../config/db');


exports.updateprofile=async(req,res)=>{
    const {firstName ,lastName,qualification}=req.body
    if(!firstName,!lastName,!qualification){
        return res.status(400).json({
            statusCode:400,
            message:'Missing Required Fileds'
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
