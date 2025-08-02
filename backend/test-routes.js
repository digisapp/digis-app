console.log('Starting route test...');
require('dotenv').config();

const testRoute = async (name, path) => {
  try {
    console.log(`Testing ${name}...`);
    require(path);
    console.log(`✅ ${name} loaded successfully`);
  } catch (error) {
    console.error(`❌ ${name} failed:`, error.message);
  }
};

const routes = [
  ['auth', './routes/auth'],
  ['payments', './routes/payments'],
  ['agora', './routes/agora'],
  ['users', './routes/users'],
  ['tokens', './routes/tokens'],
  ['subscriptions', './routes/subscriptions'],
  ['gifts', './routes/gifts'],
  ['tips', './routes/tips'],
  ['polls', './routes/polls'],
  ['questions', './routes/questions'],
  ['messages', './routes/messages'],
  ['chat', './routes/chat'],
  ['notifications', './routes/notifications'],
  ['badges', './routes/badges'],
  ['discovery', './routes/discovery'],
  ['goals', './routes/goals'],
  ['challenges', './routes/challenges'],
  ['admin', './routes/admin']
];

console.log('Testing routes one by one...\n');

let index = 0;
const testNext = () => {
  if (index < routes.length) {
    const [name, path] = routes[index];
    testRoute(name, path);
    index++;
    setTimeout(testNext, 100);
  } else {
    console.log('\nAll routes tested!');
    process.exit(0);
  }
};

testNext();