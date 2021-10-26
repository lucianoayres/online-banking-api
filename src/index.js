import express from 'express'
import winston from 'winston'
import accountsRouter from './routes/account.routes.js'
import { promises as fs } from 'fs'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import { swaggerDocument } from './doc.js'
import basicAuth from 'express-basic-auth'
import path from 'path'

const { readFile, writeFile } = fs

const PORT = process.env.PORT || 3000

global.fileName = path.resolve('./src/data/accounts.json')

const { combine, timestamp, label, printf } = winston.format
const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`
})
global.logger = winston.createLogger({
  level: 'silly',
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'my-bank-api.log' })
  ],
  format: combine(label({ label: 'my-bank-api' }), timestamp(), myFormat)
})

const app = express()
app.use(express.json())
app.use(cors())
app.use(express.static('public'))
app.use('/doc', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

function getRole(username) {
  // Warning: hard coded credentials for testing purposes
  if (username == 'admin') {
    return 'admin'
  } else if (username == 'joe') {
    return 'role1'
  }
}

function authorize(...allowed) {
  const isAllowed = (role) => allowed.indexOf(role) > -1

  return (req, res, next) => {
    if (req.auth.user) {
      const role = getRole(req.auth.user)

      if (isAllowed(role)) {
        next()
      } else {
        res.status(401).send('Role not allowed')
      }
    } else {
      res.status(403).send('User not found')
    }
  }
}

app.use(
  basicAuth({
    authorizer: (username, password) => {
      // Warning: hard coded credentials for testing purposes
      const userMatches = basicAuth.safeCompare(username, 'admin')
      const pwdMatches = basicAuth.safeCompare(password, 'admin')

      const user2Matches = basicAuth.safeCompare(username, 'joe')
      const pwd2Matches = basicAuth.safeCompare(password, '123456')

      return (userMatches && pwdMatches) || (user2Matches && pwd2Matches)
    }
  })
)

app.use('/account', authorize('admin'), accountsRouter)

app.listen(PORT, async () => {
  try {
    await readFile(global.fileName)
    logger.info(`API Started on port: ${PORT}`)
  } catch (err) {
    const initialJson = {
      nextId: 1,
      accounts: []
    }
    writeFile(global.fileName, JSON.stringify(initialJson))
      .then(() => {
        logger.info('API Started and File Created!')
      })
      .catch((err) => {
        logger.error(err)
      })
  }
})
