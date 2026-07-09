import * as studentService from '../services/studentService.js';

export const getStudents = async (req, res) => {
  const students = await studentService.listStudents();
  res.status(200).json({ data: students });
};
