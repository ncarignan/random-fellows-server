'use strict';

const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
require('dotenv').config();

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());

const CANVAS_API_URL = 'https://canvas.instructure.com' 

app.get('/course/:id', (request, response) => {
  return superagent.get(`${CANVAS_API_URL}/api/v1/courses`)
    .set('Authorization', `Bearer ${process.env.CANVAS_API_KEY}`)
    .then(result => response.send(result.body))
    // .then(result => getStudents(result.body[2].id))
    // .then(result => response.send(result))

    //If course id, get a specific course, if not get all courses
    // send courses to front end
    // get course by id
    // get students using the course id
})

app.get('/students/:course_id', (req, res) => {
  console.log(req.params.course_id);
  return getStudents(req.params.course_id)
  .then(result => res.send(result))
})

app.get('/login')

app.listen(PORT, () => console.log(`app is up on port ${PORT}`));


function getStudents(id, students = []) {
  return superagent.get(`${CANVAS_API_URL}/api/v1/courses/${id}/users?enrollment_type=student&per_page=500`) 
    .set('Authorization', `Bearer ${process.env.CANVAS_API_KEY}`)
    .then(studentResponse => studentResponse.body.map(student => {
      let shortName = student.name.split(' ')
      if(shortName[1]) shortName[0]+= ' ' + shortName[1][0];
      return {name: shortName[0]}
      })
    )

}


