const adminId = '713306025';  

require('dotenv').config();

const url = process.env.MONGODB_URL;
const token = process.env.TELEGRAM_TOKEN;
const instagramUrl = process.env.INSTAGRAM_URL;


const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');

const bot = new TelegramBot(token, { polling: true });

mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });

const User = mongoose.model('User', {
  userId: Number,
  username: String,
  firstName: String,
  lastName: String,
  token: {
    type: Number,
    default: 0
  }
});

const options = {
  reply_markup: {
    keyboard: [
      ['💜отримати фішку'],
      ['🤍використати фішки'],
      ['🤑 баланс фішок'],
      ['📌instagram']
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

// Функція для надсилання повідомлення користувачеві
function sendMessageToUser(chatId, message) {
  bot.sendMessage(chatId, message);
}

// Обробник команди /start
function handleStartCommand(msg) {
  const chatId = msg.chat.id;
  try {
    const existingUser = User.findOne({ userId: chatId });
    if (existingUser) {
      bot.sendMessage(chatId, 'Що вміє цей бот?\n  \n 💜Збирай фішки\n \n🤍 Обмінюй фішки на свої улюблені процедури\n \n✨Отримуй новини першими', options);
    } else {
      const { username, first_name, last_name } = msg.from;
      const user = new User({
        userId: chatId,
        username,
        firstName: first_name,
        lastName: last_name,
        token
      });
      user.save();
      // bot.sendMessage(chatId, 'Вас зареєстровано у системі!');
      bot.sendMessage(chatId, 'Виберіть опцію:', options);
    }
  } catch (error) {
    console.error('Error registering user:', error);
    bot.sendMessage(chatId, 'Виникла помилка при реєстрації. Будь ласка, спробуйте ще раз пізніше.');
  }
}

// Функція для підтвердження запиту на отримання балу
function confirmUserToken(userId) {
  User.findOne({ userId })
    .then((user) => {
      if (user) {
        const userName = user.firstName
        bot.sendMessage(adminId, `Користувач ${userName} запитує про отримання фішки. Підтвердити нарахування фішки?`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Так', callback_data: `confirmToken:${userId}` }],
              [{ text: 'Ні', callback_data: `rejectToken:${userId}` }]
            ]
          }
        });
      } else {
        bot.sendMessage(adminId, 'Користувача не знайдено.');
      }
    })
    .catch((error) => {
      console.error('Error finding user:', error);
      bot.sendMessage(adminId, 'Виникла помилка при отриманні даних користувача.');
    });
}

// Функція для нарахування балу користувачеві
function confirmToken(chatId, userId) {
  User.findOneAndUpdate({ userId }, { $inc: { token: 1 } }, { new: true })
    .then((user) => {
      if (user) {
        const token = user.token;
        bot.sendMessage(userId, `Клац- клац ✨✨\n \nВам додали 1 фішку 💜\n \nЧудових брів та гарного настрою ☺️`);
      } else {
        bot.sendMessage(userId, 'Користувача не знайдено.');
      }
    })
    .catch((error) => {
      console.error('Error updating token:', error);
      bot.sendMessage(userId, 'Виникла помилка при отриманні фішки. Будь ласка, спробуйте ще раз пізніше.');
    });
}

// Обробник команди "Отримати бал"
function handleGetTokenCommand(msg) {
  
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Запит надіслано 😇✨\n \n P.S. Будь ласка, відправляйте запити лише коли ви знаходитесь поруч з майстром ☺️')
  confirmUserToken(chatId);
}

// Обробник відповіді на запит на отримання балу
function handleCallbackQuery(callbackQuery) {
  const query = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;

  if (query === 'back') {
    sendMessageToUser(chatId, 'Виберіть опцію:', options);
  } else if (query.startsWith('confirmToken')) {
    const [, userId] = query.split(':');
    confirmToken(chatId, userId);
  } else if (query.startsWith('rejectToken')) {
    bot.sendMessage(adminId, 'Запит на отримання фішок відхилений адміністратором.');
  } else if (query.startsWith('exchange')) {
    const [, tokens, discount] = query.split(':');
    confirmToken(chatId, tokens);
  }
}

bot.onText(/\/start/, handleStartCommand);

bot.onText(/^(💜отримати фішку)$/, handleGetTokenCommand);

bot.on('callback_query', handleCallbackQuery);

// Функція для перевірки балу користувача
async function checkUserTokens(msg) {
  const chatId = msg.chat.id;

  try {
    const user = await User.findOne({ userId: chatId });
    if (user) {
      const tokens = user.token;
      sendMessageToUser(chatId, `Твій баланс фішок :${tokens}💜\n \nПродовжуйте в тому ж дусі ✨`);
    } else {
      sendMessageToUser(chatId, 'Користувача не знайдено.');
    }
  } catch (error) {
    console.error('Error finding user:', error);
    sendMessageToUser(chatId, 'Виникла помилка при отриманні фішок. Будь ласка, спробуйте ще раз пізніше.');
  }
}

// Обробник команди "Перевірити бали"
bot.onText(/^(🤑 баланс фішок)$/, checkUserTokens);

// Функція для списання балів при обміні
async function deductTokens(userId, tokens) {
  try {
    const updatedUser = await User.findOneAndUpdate({ userId: userId }, { $inc: { token: -tokens } }, { new: true });
    if (updatedUser) {
      const updatedTokens = updatedUser.token;
      sendMessageToUser(userId, `Ви обміняли ${tokens} фішки на знижку в ${tokens * 20} грн. Ваш залишок фішок: ${updatedTokens}`);
    } else {
      sendMessageToUser(userId, 'Користувача не знайдено.');
    }
  } catch (error) {
    console.error('Error deducting tokens:', error);
    sendMessageToUser(userId, 'Виникла помилка при списанні фішок. Будь ласка, спробуйте ще раз пізніше.');
  }
}

// Функція для підтвердження запиту на обмін балів
function confirmTokenExchange(userId, tokens, discount) {
  User.findOne({ userId })
    .then((user) => {
      if (user) {
        const userName = user.firstName;
        bot.sendMessage(adminId, `Користувач ${userName} бажає обміняти ${tokens} фішок на знижку в ${discount} грн. Підтвердити обмін?`, {
          reply_markup: {
            inline_keyboard: [
        [{ text: 'Так', callback_data: `confirmExchange:${userId}:${tokens}:${discount}` }],
        [{ text: 'Ні', callback_data: `rejectExchange:${userId}` }]
      ]
    }
  });
}
})
}

// Функція для обробки відповіді на запит на обмін балів
function handleExchangeTokensCallback(query) {
  const data = query.data;
  const chatId = query.message.chat.id;

  if (data === 'back') {
    sendMessageToUser(chatId, 'Виберіть опцію:', options);
  } else if (data.startsWith('exchange')) {
    const [, tokens, discount] = data.split(':');
    confirmTokenExchange(chatId, tokens, discount);
  } else if (data.startsWith('confirmExchange')) {
    const [, userId, tokens, discount] = data.split(':');
    deductTokens(userId, tokens);
  } else if (data.startsWith('rejectExchange')) {
    sendMessageToUser(chatId, 'Ваш запит на обмін фішок відхилено.');
  }
}

// Функція для обробки команди "Міняти Бали"
function handleExchangeTokens(msg) {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, 'Оберіть варіант обміну фішок:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '1 фішка - 20 грн', callback_data: 'exchange:1:20' }],
        [{ text: '3 фішки - 60 грн', callback_data: 'exchange:3:60' }],
        [{ text: '5 фішок - 100 грн', callback_data: 'exchange:5:100' }],
        [{ text: 'Назад', callback_data: 'back' }]
      ]
    }
  });
}

// Обробник команди "Міняти Бали"
bot.onText(/^(🤍використати фішки)$/, handleExchangeTokens);

bot.on('callback_query', handleExchangeTokensCallback);


// Функція для обробки команди "Інстаграм"
function handleInstagramCommand(msg) {
  const chatId = msg.chat.id;
  sendMessageToUser(chatId, instagramUrl);
}

// Обробник команди "Інстаграм"
bot.onText(/^(📌instagram)$/, handleInstagramCommand);