FROM node:14
WORKDIR /usr/src/app
COPY ./trigger/package*.json /usr/src/app/

RUN npm install
COPY ./trigger /usr/src/app/

EXPOSE 3000
CMD [ "npm", "start" ]