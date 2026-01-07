const express = require("express");
const path = require("path");
const cors = require("cors");
const user=require('./routes/userroutes');
const category=require('./routes/categoryroutes');
const course=require('./routes/courseroutes');
const assignment=require('./routes/assignmentroutes');
const tutor=require('./routes/tutorroutes');
const studentcourse=require('./routes/studentcourseroutes')
const studentassignment=require('./routes/studentassignmentroutes');
const feedbacks =require('./routes/feedbackroutes');
const announcement=require('./routes/announcementroutes');

const app = express();

app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); 
app.use(express.json());
app.use(cors()); 

app.use('/userroutes',user);
app.use('/category',category);
app.use('/course',course);
app.use('/assignment',assignment);
app.use('/tutor',tutor);
app.use('/studentcourse',studentcourse);
app.use('/studentassignment',studentassignment);
app.use('/feedbacks',feedbacks);
app.use('/announcement',announcement);


app.listen(5000, () => {
    console.log("Server is running on port 5000");
});
