# random-fellows-server


NEEDS :   

- Create random project teams
  - Pairings, need student ids
- Create a group category with lab name
- put students into groups
- Tie groups to the assignment for grading


NOTES : chainable interface: make one request, highlight a query parameter that is returned by first request that needs to be found in the second, look through req.body for that value
ex: choose add a course, then add students, in students you click on the parameter ':course_id/' and then it will look for the course_id after searching for it in the body of the first request