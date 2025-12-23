const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

/**
 * Mock данные
 */
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

/**
 * 1️⃣ GET — список докторов
 */
app.get('/api/doctors', (req, res) => {
  res.json({ doctors });
});

/**
 * 2️⃣ GET — доступные даты для врача (когда можно записаться)
 * 
 * Использование:
 *   GET /api/dates?doctor=Терапевт
 *   GET /api/dates?doctor=Кардиолог
 *   GET /api/dates?doctor=Невролог
 * 
 * Параметры:
 *   doctor (query, обязательный) - имя врача
 * 
 * Ответ:
 *   {
 *     "doctor": "Терапевт",
 *     "dates": ["01.06.25", "02.06.25"]
 *   }
 * 
 * Ошибки:
 *   400 - если не указан параметр doctor
 *   404 - если врач не найден
 */
app.get('/api/dates', (req, res) => {
  const { doctor } = req.query;

  if (!doctor) {
    return res.status(400).json({
      error: 'doctor is required',
      message: 'Укажите параметр doctor в query string. Пример: /api/dates?doctor=Терапевт'
    });
  }

  // Проверяем, существует ли такой врач
  if (!doctors.includes(doctor)) {
    return res.status(404).json({
      error: 'Doctor not found',
      message: `Врач "${doctor}" не найден. Доступные врачи: ${doctors.join(', ')}`,
      availableDoctors: doctors
    });
  }

  // Получаем все даты, для которых есть доступные слоты у этого врача
  const doctorSchedule = schedule[doctor] || {};
  const dates = Object.keys(doctorSchedule).filter(date => {
    const times = doctorSchedule[date] || [];
    return times.length > 0; // Возвращаем только даты с доступными слотами
  });

  res.json({
    doctor,
    dates,
    count: dates.length
  });
});

/**
 * 3️⃣ GET — доступное время
 * query:
 *  doctor=Терапевт
 *  date=01.06.25
 */
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

/**
 * 4️⃣ POST — запись к врачу
 */
app.post('/api/appointments', (req, res) => {
  const { doctor, date, time, patient } = req.body;

  if (!doctor || !date || !time || !patient) {
    return res.status(400).json({
      error: 'doctor, date, time and patient are required'
    });
  }

  // проверка, что слот существует
  const availableTimes = schedule[doctor]?.[date] || [];
  if (!availableTimes.includes(time)) {
    return res.status(409).json({
      error: 'Time slot is not available'
    });
  }

  // "занимаем" слот
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

/**
 * Запуск сервера
 */
const PORT = 3003;
app.listen(PORT, () => {
  console.log(`Mock API server running on http://localhost:${PORT}`);
});
