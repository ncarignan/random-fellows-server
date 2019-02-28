'use strict';

const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const pg = require('pg');

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.use(express.urlencoded({extended: true}))

const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.error(err));


const CANVAS_API_URL = 'https://canvas.instructure.com' 

app.post('/login', handle_login);

app.post('/canvas_key', save_canvas_key);

app.post('/canvas', make_canvas_request); // I am imagining a final custom form with a drop down of every canvas request, similar format to postman, with fillables for any data the front end needs, the server handles anything else

app.get('/course/:id', (req, res) => {
  return superagent.get(`${CANVAS_API_URL}/api/v1/courses`)
    .set('Authorization', `Bearer ${process.env.CANVAS_API_KEY}`)
    .then(result => res.send(result.body))
})

app.get('/students/:course_id', (req, res) => {
  console.log(req.params.course_id);
  return getStudents(req.params.course_id)
  .then(result => res.send(result))
})


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

async function make_canvas_request (req, res) {
  let token = req.headers['x-access-token'];
  token = jwt.verify(token, process.env.JWT_SECRET);
  const {rows} = await client.query(`SELECT canvas_api_key FROM canvas_keys WHERE id=$1`, [token.user_id]);
  if(!rows[0]) return res.sendStatus(400);
  const {body, headers} = req;
  let {target} = body;
  target += '?';
  delete body.target;

  const queries = Object.entries(body);
  queries.forEach((query, idx) => {
    target = `${target}${query[0]}=${query[1]}${idx == queries.length - 1 ? '' : '&'}`
  })

  // const {rows} = await client.query()

  const response = await superagent.get(target)
    .set('Authorization', `Bearer ${process.env.CANVAS_API_KEY}`)
    .catch(err => res.status(404).send(err))
  
    res.send(target);
}

async function handle_login(req, res){
  const user_match = await client.query(`SELECT * FROM authentication WHERE name=$1`, [req.body.name])
  if(user_match.rows.length > 0 && user_match.rows[0].passhash === req.body.passhash){
    const token = jwt.sign({ name: req.body.name, passhash: req.body.passhash, user_id: user_match.rows[0].user_id }, process.env.JWT_SECRET)
    return res.send({token});
  } else if(user_match.rows.length > 0){
    return res.status(400).send({message: 'not logged in'})
  } else {
    const user_id = await client.query(`INSERT INTO authentication (name, passhash) values ($1, $2) RETURNING user_id`, [req.body.name, req.body.passhash]);
    const token = jwt.sign({ name: req.body.name, passhash: req.body.passhash, user_id }, process.env.JWT_SECRET)
    return res.send({token, new_user: true});
  }
}

async function save_canvas_key(req, res){
  const {canvas_api_key} = req.body;
  let token = req.headers['x-access-token'];
  token = jwt.verify(token, process.env.JWT_SECRET);

  const UPDATE = `
    UPDATE canvas_keys 
    SET canvas_api_key=$2 
    WHERE id=$1;
  `
  const INSERT = `
    INSERT INTO canvas_keys (id, canvas_api_key) 
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING;
  `
  await client.query(INSERT, [token.user_id, canvas_api_key]);
  await client.query(UPDATE, [token.user_id, canvas_api_key]);
  res.sendStatus(200);
}














