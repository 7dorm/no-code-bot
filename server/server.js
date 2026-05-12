const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const query = Object.keys(req.query || {}).length ? req.query : undefined;
  const body = Object.keys(req.body || {}).length ? req.body : undefined;
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`, { query, body });
  next();
});


const doctors = [
  'Терапевт',
  'Кардиолог',
  'Невролог'
];

const schedule = {
  'Терапевт': {
    '01.06.25': ['10:00', '10:30', '11:00'],
    '02.06.25': ['12:00', '12:30']
  },
  'Кардиолог': {
    '01.06.25': ['09:00', '09:30'],
  },
  'Невролог': {
    '01.06.25': ['14:00', '14:30', '15:00']
  }
};



const appointments = [];


app.get('/api/doctors', (req, res) => {
  res.json({ doctors });
});


app.get('/api/dates', (req, res) => {
  const { doctor } = req.query;

  if (!doctor) {
    return res.status(400).json({
      error: 'doctor is required',
      message: 'Укажите параметр doctor в query string. Пример: /api/dates?doctor=Терапевт'
    });
  }

  
  if (!doctors.includes(doctor)) {
    return res.status(404).json({
      error: 'Doctor not found',
      message: `Врач "${doctor}" не найден. Доступные врачи: ${doctors.join(', ')}`,
      availableDoctors: doctors
    });
  }

  
  const doctorSchedule = schedule[doctor] || {};
  const dates = Object.keys(doctorSchedule).filter(date => {
    const times = doctorSchedule[date] || [];
    return times.length > 0; 
  });

  res.json({
    doctor,
    dates,
    count: dates.length
  });
});


app.get('/api/slots', (req, res) => {
  const { doctor, date } = req.query;

  if (!doctor || !date) {
    return res.status(400).json({
      error: 'doctor and date are required'
    });
  }

  const times = schedule[doctor]?.[date] || [];
  res.json({
    doctor,
    date,
    times
  });
});


app.post('/api/appointments', (req, res) => {
  const { doctor, date, time, patient } = req.body;

  if (!doctor || !date || !time || !patient) {
    return res.status(400).json({
      error: 'doctor, date, time and patient are required'
    });
  }

  
  const availableTimes = schedule[doctor]?.[date] || [];
  if (!availableTimes.includes(time)) {
    return res.status(409).json({
      error: 'Time slot is not available'
    });
  }

  
  schedule[doctor][date] = availableTimes.filter(t => t !== time);

  const appointment = {
    id: `apt_${Date.now()}`,
    doctor,
    date,
    time,
    patient,
    status: 'confirmed'
  };

  appointments.push(appointment);

  res.json(appointment);
});


const PORT = 3003;
app.listen(PORT, () => {
  console.log(`Mock API server running on http://localhost:${PORT}`);
});
