import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalCategory, categoryLabel, categoryOrder, DEFAULT_CATEGORIES, normalizeCategories } from './categories.ts';

test('categoryLabel gives the English tab name for the counter screen', () => {
  assert.equal(categoryLabel('mutton', DEFAULT_CATEGORIES, 'en'), 'Mutton');
  assert.equal(categoryLabel('other', DEFAULT_CATEGORIES, 'en'), 'Others');
  assert.equal(categoryLabel('offal', DEFAULT_CATEGORIES, 'en'), 'Offal'); // a tab name from an earlier version
  assert.equal(categoryLabel('mystery', DEFAULT_CATEGORIES, 'en'), 'mystery');
  assert.equal(categoryLabel('fish', [{ key: 'fish', name: 'Fish', nameTa: 'மீன்' }], 'en'), 'Fish');
});

test('categoryLabel uses the list given, then older names, then the key', () => {
  assert.equal(categoryLabel('mutton'), 'மட்டன்');
  assert.equal(categoryLabel('offal'), 'ஈரல் • குடல் • இரத்தம்'); // a tab name from an earlier version
  assert.equal(categoryLabel('mystery'), 'mystery');
  assert.equal(categoryLabel('fish', [{ key: 'fish', name: 'Fish', nameTa: 'மீன்' }]), 'மீன்');
});

test('categoryOrder follows the list and puts unknown categories last', () => {
  assert.deepEqual(DEFAULT_CATEGORIES.map((c) => c.key), ['chicken', 'other', 'mutton']); // the three tabs, in this order
  assert.equal(categoryOrder('chicken'), 0);
  assert.equal(categoryOrder('other'), 1);
  assert.equal(categoryOrder('mutton'), 2);
  assert.equal(categoryOrder('mystery'), DEFAULT_CATEGORIES.length);
});

test('normalizeCategories keeps valid entries, drops bad and repeated ones, and never returns an empty list', () => {
  const list = normalizeCategories([
    { key: 'chicken', name: 'Chicken', nameTa: 'கோழி', image: 'chicken' },
    { key: 'chicken', name: 'Again', nameTa: 'மீண்டும்' },
    { key: '', name: 'No key', nameTa: 'x' },
    { key: 'ta-only', nameTa: 'தமிழ்' },
    { key: 'empty-names' },
    null,
  ]);
  assert.deepEqual(list.map((c) => c.key), ['chicken', 'ta-only']);
  assert.equal(list[0].image, 'chicken');
  assert.equal(list[1].name, 'தமிழ்'); // a missing English name borrows the Tamil one
  for (const bad of [undefined, null, [], 'x', [{}]]) assert.deepEqual(normalizeCategories(bad), DEFAULT_CATEGORIES);
});

test('canonicalCategory folds earlier categories into the three tabs and keeps current or unknown ones', () => {
  for (const old of ['broiler', 'naatukoli', 'kadai']) assert.equal(canonicalCategory(old), 'chicken');
  assert.equal(canonicalCategory('offal'), 'mutton');
  assert.equal(canonicalCategory('more'), 'other');
  for (const same of ['chicken', 'other', 'mutton', 'fish']) assert.equal(canonicalCategory(same), same);
});
