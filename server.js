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
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.error(err));


const CANVAS_API_URL = 'https://canvas.instructure.com' 

app.post('/login', handle_login);

app.post('/canvas_key', save_canvas_key);

app.post('/canvas', make_chained_canvas_requests); // I am imagining a final custom form with a drop down of every canvas request, similar format to postman, with fillables for any data the front end needs, the server handles anything else

app.get('/course/:id', (req, res) => {
  return superagent.get(`${CANVAS_API_URL}/api/v1/courses`)
    .set('Authorization', `Bearer ${process.env.CANVAS_API_KEY}`)
    .then(result => res.send(result.body))
})

app.get('/students/:course_id', getStudents)


app.listen(PORT, () => console.log(`app is up on port ${PORT}`));


async function getStudents(req, res) {
  const { params, headers } = req;
  let token = headers['x-access-token'];
  token = jwt.verify(token, process.env.JWT_SECRET);
  const { rows } = await client.query(`SELECT canvas_api_key FROM canvas_keys WHERE id=$1`, [token.user_id]);
  if (!rows[0]) return res.sendStatus(400);

  await superagent.get(`${CANVAS_API_URL}/api/v1/courses/${params.course_id}/users?enrollment_type=student&per_page=500`) 
    .set('Authorization', `Bearer ${rows[0].canvas_api_key}`)
        .then(result => res.send(result.body))
        // .then(result => result.body)
    // .then(studentResponse => studentResponse.body.map(student => {
    //   let shortName = student.name.split(' ')
    //   if(shortName[1]) shortName[0]+= ' ' + shortName[1][0];
    //   return {name: shortName[0]}
    //   })
    // )
}

async function make_canvas_request (req, res) {
  const {body, headers} = req;
  let token = headers['x-access-token'];
  token = jwt.verify(token, process.env.JWT_SECRET);
  const {rows} = await client.query(`SELECT canvas_api_key FROM canvas_keys WHERE id=$1`, [token.user_id]);
  if(!rows[0]) return res.sendStatus(400);
  let {target} = body;
  target += '?';
  delete body.target;

  const queries = Object.entries(body);
  queries.forEach((query, idx) => {
    target = `${target}${query[0]}=${query[1]}${idx == queries.length - 1 ? '' : '&'}`
  })
  // const {rows} = await client.query()

  return superagent.get(target)
    .set('Authorization', `Bearer ${process.env.CANVAS_API_KEY}`)
    .catch(err => res.status(404).send(err))
    .then(result => res.send(result.body))
}

async function make_chained_canvas_requests(req, res) {
  const { body, headers } = req;
  let token = headers['x-access-token'];
  token = jwt.verify(token, process.env.JWT_SECRET);
  const { rows } = await client.query(`SELECT canvas_api_key FROM canvas_keys WHERE id=$1`, [token.user_id]);
  if (!rows[0]) return res.sendStatus(400);
  const {requests} = body;

  let interrem_result_body = {};

  while(requests.length){
    const current = requests.shift();
    let { target, queries } = current;
    target += '?';
    
    queries = Object.entries(queries);
    queries.forEach((query, idx) => {
      target = `${target}${query[0]}=${query[1] ? query[1] : interrem_result_body[query[0]]}${idx == queries.length - 1 ? '' : '&'}`
    console.log(target);
    })
    await superagent.get(target)
      .set('Authorization', `Bearer ${rows[0].canvas_api_key}`)
      .catch(err => {
        console.error(err)
        res.status(404).send(err)
      })
      .then(result => interrem_result_body = result.body)
  }

  res.send(interrem_result_body)
}

async function handle_login(req, res){
  const user_match = await client.query(`SELECT * FROM authentication WHERE name=$1`, [req.body.name])
  if(user_match.rows.length > 0 && user_match.rows[0].password === req.body.password){
    const token = jwt.sign({ name: req.body.name, password: req.body.password, user_id: user_match.rows[0].user_id }, process.env.JWT_SECRET)
    return res.send({token});
  } else if(user_match.rows.length > 0){
    return res.status(400).send({message: 'not logged in'})
  } else {
    const user_id = await client.query(`INSERT INTO authentication (name, password) values ($1, $2) RETURNING user_id`, [req.body.name, req.body.password]);
    const token = jwt.sign({ name: req.body.name, password: req.body.password, user_id }, process.env.JWT_SECRET)
    return res.send({token, new_user: true});
  }
}

async function save_canvas_key(req, res){
  const {body, headers} = req;
  const {canvas_api_key} = body;
  let token = headers['x-access-token'];
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














