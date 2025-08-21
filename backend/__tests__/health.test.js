import request from 'supertest'
import app from '../src/app.js'

describe('GET /health', () => {
  it('returns ok:true and a timestamp', async () => {
    const res = await request(app).get('/health').expect(200)
    expect(res.body.ok).toBe(true)
    expect(typeof res.body.time).toBe('string')
  })
})
