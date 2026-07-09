INSERT INTO users (name, email, role)
VALUES
  ('Admin User', 'admin@lms.local', 'admin'),
  ('Maya Singh', 'maya.singh@lms.local', 'student'),
  ('Omar Khan', 'omar.khan@lms.local', 'student'),
  ('Elena Brooks', 'elena.brooks@lms.local', 'teacher')
ON CONFLICT (email) DO NOTHING;

INSERT INTO courses (title, description)
VALUES
  ('Full Stack Foundations', 'Core concepts for building modern web applications.'),
  ('PostgreSQL for Developers', 'Relational data modeling, indexes, and practical SQL.'),
  ('DevOps with Docker', 'Containerized deployment workflows for production systems.')
ON CONFLICT DO NOTHING;

INSERT INTO enrollments (user_id, course_id)
SELECT users.id, courses.id
FROM users
JOIN courses ON courses.title IN ('Full Stack Foundations', 'DevOps with Docker')
WHERE users.email = 'maya.singh@lms.local'
ON CONFLICT DO NOTHING;

INSERT INTO enrollments (user_id, course_id)
SELECT users.id, courses.id
FROM users
JOIN courses ON courses.title = 'PostgreSQL for Developers'
WHERE users.email = 'omar.khan@lms.local'
ON CONFLICT DO NOTHING;
