
import serverless from 'serverless-http';
import express from 'express';
import morgan from 'morgan';
import cookieSession from 'cookie-session';
import axios from 'axios';

const app = express();
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieSession({
  name: 'sess',
  keys: [process.env.SESSION_SECRET || 'dev'],
  maxAge: 24 * 60 * 60 * 1000
}));

async function getAccessToken({ code, store_domain }) {
  const url = `https://${store_domain}/admin/oauth/access_token`;
  const { data } = await axios.post(url, {
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    code
  });
  if (!data?.access_token) throw new Error('Token não retornado');
  return data.access_token;
}

async function ensureScriptTag({ access_token, store_domain }) {
  const api = axios.create({
    baseURL: `https://${store_domain}/admin`,
    headers: { 'Authentication-Token': access_token }
  });
  const { data } = await api.get('/scripts');
  const scripts = Array.isArray(data) ? data : (data?.scripts || []);
  const exists = scripts.some(s => (s.src || '').includes('/assets/preorder.js'));
  if (!exists) {
    await api.post('/scripts', {
      src: `${process.env.APP_URL}/assets/preorder.js`,
      event: 'onload',
      where: 'store'
    });
  }
}

app.get('/install', (req, res) => {
  const { store_domain } = req.query;
  if (!store_domain) return res.status(400).send('store_domain é obrigatório');
  const redirect = `https://${store_domain}/admin/oauth/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.APP_URL + '/oauth/callback')}&response_type=code&scope=read_products,write_products,read_orders,write_orders,read_script_tags,write_script_tags`;
  res.redirect(redirect);
});

app.get('/oauth/callback', async (req, res) => {
  const { code, store_domain } = req.query;
  if (!code || !store_domain) return res.status(400).send('code/store_domain ausentes');
  try {
    const token = await getAccessToken({ code, store_domain });
    await ensureScriptTag({ access_token: token, store_domain });
    res.send('App instalado! Você pode fechar esta janela.');
  } catch (err) {
    console.error('oauth callback error', err?.response?.data || err.message);
    res.status(500).send('Erro na instalação do app.');
  }
});

app.post('/webhooks/orders/create', async (req, res) => {
  try {
    const order = req.body || {};
    const products = order.products || order.items || [];
    const hasPreorder = products.some(p => {
      const props = p.properties || p.line_item_properties || [];
      return props.some(prop =>
        (prop.name || prop.key) === 'type' &&
        (prop.value || prop.val) === 'preorder'
      );
    });

    if (hasPreorder) {
      console.log('[webhook] Pedido PREORDER:', order.id || order.number);
    }
    res.sendStatus(200);
  } catch (e) {
    console.error('webhook error', e.message);
    res.sendStatus(500);
  }
});

export const handler = serverless(app);
