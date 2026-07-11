'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const initialState = {
  health: null,
  courses: [],
  students: [],
};

export default function HomePage() {
  const [dashboard, setDashboard] = useState(initialState);
  const [status, setStatus] = useState('Loading LMS data...');
  const [loginResult, setLoginResult] = useState(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [health, courses, students] = await Promise.all([
          api.getHealth(),
          api.getCourses(),
          api.getStudents(),
        ]);

        setDashboard({
          health,
          courses: courses.data,
          students: students.data,
        });
        setStatus('Connected to API and PostgreSQL');
      } catch (error) {
        setStatus(error.message);
      }
    };

    loadDashboard();
  }, []);

  const handleDummyLogin = async () => {
    try {
      const result = await api.login({
        email: 'admin@lms.local',
        password: 'password',
      });
      setLoginResult(result);
    } catch (error) {
      setLoginResult({ error: error.message });
    }
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Professional Docker stack</p>
          <h1>CGS Learning Management System</h1>
          <p>
            Next.js runs behind Nginx and talks only to the Express API. The API
            remains separate so future mobile applications can reuse it.
          </p>
        </div>
        <div className="status-card">
          <span>System status</span>
          <strong>{status}</strong>
          {dashboard.health?.database && (
            <small>
              Database checked at{' '}
              {new Date(dashboard.health.database.checkedAt).toLocaleString()}
            </small>
          )}
        </div>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Courses</h2>
          <ul>
            {dashboard.courses.map((course) => (
              <li key={course.id}>
                <strong>{course.title}</strong>
                <span>{course.description}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Students</h2>
          <ul>
            {dashboard.students.map((student) => (
              <li key={student.id}>
                <strong>{student.name}</strong>
                <span>
                  {student.email} | {student.enrolled_courses} enrolled course
                  {student.enrolled_courses === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="card login-card">
        <div>
          <h2>Dummy Login</h2>
          <p>Uses the seeded admin account and returns a local-only token from the API.</p>
        </div>
        <button type="button" onClick={handleDummyLogin}>
          Test Login Endpoint
        </button>
        {loginResult && <pre>{JSON.stringify(loginResult, null, 2)}</pre>}
      </section>
    </main>
  );
}
