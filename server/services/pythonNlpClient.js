/**
 * pythonNlpClient.js
 * Single point of contact for the Node backend's calls to the Python NLP
 * microservice (python_services/app.py). Controllers should call these
 * functions instead of using axios directly against PYTHON_URL.
 */

const axios = require("axios");
const FormData = require("form-data");

const PYTHON_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:5001";

// POST /parse-resume — multipart file upload, returns parsed resume + intelligence
const parseResume = async (fileStream, fileType) => {
  const formData = new FormData();
  formData.append("file", fileStream);
  formData.append("file_type", fileType);

  const response = await axios.post(`${PYTHON_URL}/parse-resume`, formData, {
    headers: formData.getHeaders(),
    timeout: 60000,
  });
  return response.data;
};

// POST /analyze-intelligence — generate a candidate intelligence report from parsed resume data
const analyzeIntelligence = async (parsed) => {
  const response = await axios.post(
    `${PYTHON_URL}/analyze-intelligence`,
    { parsed },
    { timeout: 30000 }
  );
  return response.data;
};

// POST /generate-questions-hybrid — resume-derived + dataset hybrid question set
const generateHybridQuestions = async ({ parsed, intelligence, datasetQuestions, count, interviewType }) => {
  const response = await axios.post(
    `${PYTHON_URL}/generate-questions-hybrid`,
    {
      parsed,
      intelligence: intelligence || {},
      dataset_questions: datasetQuestions,
      count,
      interview_type: interviewType,
    },
    { timeout: 30000 }
  );
  return response.data;
};

// POST /evaluate-answer — semantic + confidence + plagiarism evaluation
const evaluateAnswer = async ({ userAnswer, idealAnswer, keywords, answerMode, timeTakenSeconds }) => {
  const response = await axios.post(
    `${PYTHON_URL}/evaluate-answer`,
    {
      user_answer: userAnswer,
      ideal_answer: idealAnswer,
      keywords,
      answer_mode: answerMode,
      time_taken: timeTakenSeconds,
    },
    { timeout: 30000 }
  );
  return response.data;
};

module.exports = {
  parseResume,
  analyzeIntelligence,
  generateHybridQuestions,
  evaluateAnswer,
};
