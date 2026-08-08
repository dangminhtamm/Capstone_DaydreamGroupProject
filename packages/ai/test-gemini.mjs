import { GoogleGenerativeAI } from '@google/generative-ai';
const ai = new GoogleGenerativeAI('dummy-key');
const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' }, { baseUrl: 'https://api.tuturuuu.com/api/gproxy/gemini' });
model.generateContent('hello').catch(e => console.log(e.message));
