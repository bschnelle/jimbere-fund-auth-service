// eslint-disable-next-line
const AWS = require('aws-sdk');
const fetch = require('node-fetch');

const s3 = new AWS.S3();
const dynamo = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });

module.exports.supportersSignUp = (event, context, cb) => {
  const error = () => cb('Internal error');

  const getTypeformApiKey = () => new Promise((resolve, reject) => {
    const params = {
      Bucket: 'jimbere-fund-secrets',
      Key: 'typeform.json',
    };

    s3.getObject(params, (err, data) => {
      if (err) reject();
      else resolve(data);
    });
  });

  const getTypeformFormDefinition = (data) => {
    const form = event.body;
    const url = `https://api.typeform.io/v0.4/forms/${form.uid || form.id}`;
    const apiKey = JSON.parse(data.Body.toString())['api-key'];
    const options = { headers: { 'X-API-TOKEN': apiKey } };

    return fetch(url, options).then((res) => {
      if (!res.ok) throw new Error();
      else return res.json();
    });
  };

  const createNewUser = (formDefinition) => new Promise((resolve, reject) => {
    /* map field ids to refs */
    const fieldMapping = formDefinition.fields.reduce((mapping, field) => (
      Object.assign({ [field.id]: field.ref }, mapping)
    ), {});

    /* map answers to refs */
    const Item = {};
    event.body.answers.forEach((answer) => {
      const ref = fieldMapping[answer.field_id];
      if (ref) Item[ref] = answer.value;
    });

    /* create new user in dynamo */
    dynamo.put({ Item, TableName: 'users' }, (e) => {
      if (e) reject();
      else cb(null);
    });
  });

  getTypeformApiKey()
    .then(getTypeformFormDefinition)
    .then(createNewUser)
    .catch(error);
};
