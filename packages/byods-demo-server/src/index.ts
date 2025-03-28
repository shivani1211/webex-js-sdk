import logger from 'jet-logger';
import server from './server';

// **** Run **** //

const SERVER_START_MSG = `BYoDS server started on port: ${process.env.port || 3000}`;

server.listen(process.env.port || 3000, () => logger.info(SERVER_START_MSG));
