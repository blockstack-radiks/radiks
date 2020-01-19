import './mocks/crypto';
import './setup';
import { verifyECDSA } from 'blockstack/lib/encryption';
import { fakeModel, TestModel } from './helpers';
import User from '../src/models/user';
import SigningKey from '../src/models/signing-key';

test('encrypts data', async (t) => {
  // crypto.getRandomValues(16);
  const model = fakeModel();
  const encrypted = await model.encrypted();
  expect(encrypted.name).toEqual(model.attrs.name);
  expect(encrypted.description).not.toEqual(model.attrs.description);
  expect(encrypted.tags).not.toEqual(model.attrs.tags);
  expect(encrypted.metadata).not.toEqual(model.attrs.metadata);
  expect(encrypted.number).not.toEqual(model.attrs.number);
  t();
});

test('decrypts data', async (t) => {
  const model = fakeModel();
  const encrypted = await model.encrypted();
  const decrypted = new model.constructor(encrypted);
  await decrypted.decrypt();
  expect(decrypted.attrs.name).toEqual(model.attrs.name);
  expect(decrypted.attrs.metadata).toEqual(model.attrs.metadata);
  expect(decrypted.attrs.description).toEqual(model.attrs.description);
  expect(decrypted.attrs.tags).toEqual(model.attrs.tags);
  expect(decrypted.attrs.number).toEqual(model.attrs.number);
  t();
});

test('saves to server', async () => {
  await User.createWithCurrentUser();
  const model = fakeModel();
  await model.save();
  const doc = await TestModel.findById(model._id, { decrypt: false });
  expect(doc.attrs.name).toEqual(model.attrs.name);
  expect(doc.attrs.description).not.toEqual(model.attrs.description);
});

test('can save and fetch', async () => {
  await User.createWithCurrentUser();
  const model = fakeModel();
  await model.save();
  await model.fetch();
});


test('it fetches a signing key and saves with model', async () => {
  const user = await User.createWithCurrentUser();
  const model = fakeModel();
  await model.save();
  expect(model.attrs.signingKeyId).toEqual(user.attrs.personalSigningKeyId);
});

test('it fetch a list of models', async () => {
  const user = await User.createWithCurrentUser();
  const model = fakeModel();
  await model.save();
  const result = await TestModel.fetchList({ name: 'tester' });
  expect(result.length).toEqual(1);
  const emptyResult = await TestModel.fetchList({ name: 'tester2' });
  expect(emptyResult.length).toEqual(0);
});

test('it fetch a list of models with $or query', async () => {
  const user = await User.createWithCurrentUser();
  const model = fakeModel();
  await model.save();
  let orResult = await TestModel.fetchList(
    { limit: 1 },
    {},
    { criteria: { $or: [{ name: 'tester' }] } }
  );
  expect(orResult.length).toEqual(1);
  orResult = await TestModel.fetchList(
    { limit: 1 },
    {},
    { criteria: { $or: [{ name: 'tester2' }] } }
  );
  expect(orResult.length).toEqual(0);
});

test('it signs ID with the signing key private key', async () => {
  const user = await User.createWithCurrentUser();
  const model = fakeModel();
  await model.save();
  const { personalSigningKeyId } = user.attrs;
  const key = await SigningKey.findById(personalSigningKeyId);
  // console.log(model.attrs);
  let message = `${model._id}-${model.attrs.updatedAt}`;
  expect(model.attrs.radiksSignature).not.toBeNull();
  expect(verifyECDSA(message, key.attrs.publicKey, model.attrs.radiksSignature)).toEqual(true);
  model.attrs.updatedAt = new Date().getTime();
  message = `${model._id}-${model.attrs.updatedAt}`;
  await model.sign();
  expect(verifyECDSA(message, key.attrs.publicKey, model.attrs.radiksSignature)).toEqual(true);
});

test('it can delete a model', async () => {
  const user = await User.createWithCurrentUser();
  const model = fakeModel();
  let deleteFileWasCalled = false;
  model.deleteFile = () => {
    deleteFileWasCalled = true;
  };
  await model.save();
  await model.destroy();
  expect(deleteFileWasCalled).toBeTruthy();
  const fetched = await TestModel.fetchList({}, { decrypt: false });
  expect(fetched.find(m => m._id === model._id)).toBeFalsy();
});

test('it return null if model not found', async () => {
  const modelFindById = await TestModel.findById('notfound');
  expect(modelFindById).toBe(undefined);
  const modelFindOne = await TestModel.findOne({ _id: 'notfound' });
  expect(modelFindOne).toBe(undefined);
});
