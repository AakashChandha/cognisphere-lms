import * as courseService from '../services/courseService.js';

export const getCourses = async (req, res) => {
  const courses = await courseService.listCourses();
  res.status(200).json({ data: courses });
};
