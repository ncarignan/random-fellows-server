DROP TABLE canvas_keys;
DROP TABLE authentication;

  CREATE TABLE IF NOT EXISTS authentication(
    user_id SERIAL PRIMARY KEY, 
    name varchar(255) NOT NULL,
    passhash varchar(255) NOT NULL);


  CREATE TABLE IF NOT EXISTS canvas_keys(
    id INT NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(id) REFERENCES authentication(user_id),
    canvas_api_key varchar(255) NOT NULL
  );