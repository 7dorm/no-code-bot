const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());


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

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-zа-яё0-9_]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function routeWithHeuristics(input, routes = []) {
  if (!routes.length) {
    return { route: 'fallback', confidence: 0, reason: 'Нет настроенных веток' };
  }

  const normalizedInput = normalizeText(input);
  let bestRoute = routes[0];
  let bestScore = 0;

  routes.forEach(route => {
    const text = [
      route.id,
      route.title,
      route.description || '',
      ...(route.examples || [])
    ].join(' ');
    const tokens = Array.from(new Set(normalizeText(text).split(' ').filter(token => token.length > 2)));
    const score = tokens.reduce((sum, token) => (
      normalizedInput.includes(token) ? sum + 1 : sum
    ), 0);
    if (score > bestScore) {
      bestScore = score;
      bestRoute = route;
    }
  });

  return {
    route: bestRoute.id,
    confidence: bestScore ? Math.min(0.95, 0.55 + bestScore * 0.1) : 0.25,
    reason: bestScore
      ? 'Ветка выбрана серверной эвристикой по описанию и примерам'
      : 'Явных совпадений не найдено'
  };
}

function extractEntity(input, entity) {
  const text = String(input || '').trim();
  let value = null;

  if (entity.validationRegex) {
    try {
      const match = text.match(new RegExp(entity.validationRegex, 'i'));
      if (match && match[0]) value = match[0];
    } catch (e) {
      
    }
  }

  if (value === null) {
    switch (entity.type) {
      case 'phone': {
        const match = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
        value = match && match[0] ? match[0].replace(/[^\d+]/g, '') : null;
        break;
      }
      case 'email': {
        const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        value = match && match[0] ? match[0] : null;
        break;
      }
      case 'date': {
        const match = text.match(/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/i);
        value = match && match[0] ? match[0] : null;
        break;
      }
      case 'time': {
        const match = text.match(/\b\d{1,2}:\d{2}\b/);
        value = match && match[0] ? match[0] : null;
        break;
      }
      case 'number': {
        const match = text.match(/-?\d+(?:[.,]\d+)?/);
        value = match && match[0] ? Number(match[0].replace(',', '.')) : null;
        break;
      }
      case 'enum': {
        const lowerInput = text.toLowerCase();
        value = (entity.enumValues || []).find(option => lowerInput.includes(String(option).toLowerCase())) || null;
        break;
      }
      case 'boolean': {
        const lowerInput = text.toLowerCase();
        if (/\b(да|yes|true|ок|согласен|согласна)\b/i.test(lowerInput)) value = true;
        if (/\b(нет|no|false|не согласен|не согласна)\b/i.test(lowerInput)) value = false;
        break;
      }
      default:
        value = null;
        break;
    }
  }

  const found = value !== null && value !== undefined && value !== '';
  return { value, found, confidence: found ? 0.75 : 0 };
}

function extractWithHeuristics(input, entities = []) {
  const result = { entities: {}, missing: [] };

  entities.forEach(entity => {
    const extracted = extractEntity(input, entity);
    result.entities[entity.name] = extracted;
    if (entity.required && !extracted.found) {
      result.missing.push(entity.name);
    }
  });

  return result;
}


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

app.post('/api/ai/complete', (req, res) => {
  const { mode, input, routes, entities } = req.body || {};

  if (mode === 'router') {
    return res.json({
      result: routeWithHeuristics(input, routes || [])
    });
  }

  if (mode === 'extractor') {
    return res.json({
      result: extractWithHeuristics(input, entities || [])
    });
  }

  return res.status(400).json({
    error: 'Unsupported AI mode',
    supportedModes: ['router', 'extractor']
  });
});


const PORT = 3003;
app.listen(PORT, () => {
  console.log(`Mock API server running on http://localhost:${PORT}`);
});
