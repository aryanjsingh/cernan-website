/*
 * A deterministic illustration of encoder self-attention, not a pretrained model.
 * Every token can attend to every token; the tree is only a spatial arrangement.
 * Q = XWq, K = XWk, V = XWv; weights = softmax(QKᵀ / √dk).
 * Reference: https://arxiv.org/html/1706.03762v7#S3.SS2
 */
(() => {
  const DIMENSION = 12, HEAD_DIMENSION = 6;
  // Roles: 0 content, 1 action, 2 relation, 3 modifier.
  // Semantic features: meaning, context, change, sequence.
  const vocabulary = [
    ['a', 3, [.10, .20, .00, .00]],
    ['single', 3, [.25, .10, .05, .15]],
    ['thought', 0, [1.00, .85, .20, .10]],
    ['becomes', 1, [.25, .15, 1.00, .25]],
    ['clear', 3, [.95, .45, .30, .10]],
    ['when', 2, [.10, .35, .25, .90]],
    ['every', 3, [.15, .85, .10, .30]],
    ['word', 0, [.90, .75, .10, .35]],
    ['finds', 1, [.65, .70, .85, .20]],
    ['its', 2, [.20, .90, .05, .10]],
    ['place', 0, [.55, 1.00, .15, .30]],
    ['among', 2, [.25, 1.00, .10, .25]],
    ['the', 3, [.10, .35, .00, .05]],
    ['ideas', 0, [1.00, .80, .35, .20]],
    ['that', 2, [.20, .70, .10, .50]],
    ['came', 1, [.10, .30, .95, .80]],
    ['before', 2, [.10, .40, .40, 1.00]],
    ['and', 2, [.20, .70, .35, .65]],
    ['come', 1, [.15, .35, 1.00, .75]],
    ['next', 2, [.20, .45, .55, 1.00]]
  ];
  const matrix = () => Array.from({ length: DIMENSION }, () => Array(HEAD_DIMENSION).fill(0));
  const project = (vector, weights) => Array.from({ length: HEAD_DIMENSION }, (_, j) =>
    vector.reduce((sum, value, i) => sum + value * weights[i][j], 0));
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);

  function positionProjection(weights, input, output, scale, angle = 0) {
    // Linear rotation of a sine/cosine pair; no position-dependent score override.
    weights[input][output] = scale * Math.cos(angle);
    weights[input + 1][output] = -scale * Math.sin(angle);
    weights[input][output + 1] = scale * Math.sin(angle);
    weights[input + 1][output + 1] = scale * Math.cos(angle);
  }

  function projections(head) {
    const q = matrix(), k = matrix(), v = matrix();
    if (head === 0) {
      // Related meanings, with a small amount of positional context.
      for (let i = 0; i < 4; i++) q[i + 4][i] = k[i + 4][i] = 2.6;
      positionProjection(q, 10, 4, .65);
      positionProjection(k, 10, 4, .65);
    } else if (head === 1) {
      // Complementary roles: content asks for actions, actions/modifiers for content.
      [1, 0, 1, 0].forEach((targetRole, role) => { q[role][targetRole] = 3.2; });
      for (let role = 0; role < 4; role++) k[role][role] = 3.2;
      q[4][4] = k[4][4] = .9;
      q[5][5] = k[5][5] = .9;
    } else if (head === 2) {
      // Nearby context. Rotated queries favor the preceding position, without a mask.
      positionProjection(q, 8, 0, 2.3, .45);
      positionProjection(k, 8, 0, 2.3);
      positionProjection(q, 10, 2, 1.6, .15);
      positionProjection(k, 10, 2, 1.6);
      q[4][4] = k[4][4] = .5;
      q[5][5] = k[5][5] = .5;
    } else {
      // Wider associations: meaning/context and change/sequence exchange roles.
      for (let i = 0; i < 4; i++) q[i + 4][i] = 2.1;
      [5, 4, 7, 6].forEach((input, output) => { k[input][output] = 2.1; });
      positionProjection(q, 10, 4, 2.0, -.65);
      positionProjection(k, 10, 4, 2.0);
    }
    // Each head also has its own value projection. Context is computed from V,
    // never from marker positions, attention scores, or decorative animation state.
    for (let i = 0; i < DIMENSION; i++) {
      for (let j = 0; j < HEAD_DIMENSION; j++) {
        v[i][j] = Math.sin((i + 1) * (j + 2) * .61 + head * .73) / Math.sqrt(DIMENSION);
      }
    }
    return { q, k, v };
  }

  function create() {
    const tokens = vocabulary.map(([label, group], index) => Object.freeze({
      id: `t${String(index).padStart(2, '0')}`, label, group
    }));
    const embeddings = vocabulary.map(([, role, features], index) => [
      ...Array.from({ length: 4 }, (_, i) => Number(i === role)), ...features,
      Math.sin(index * .45), Math.cos(index * .45), Math.sin(index * .15), Math.cos(index * .15)
    ]);
    const heads = Array.from({ length: 4 }, (_, head) => {
      const weights = projections(head);
      return {
        queries: embeddings.map(x => project(x, weights.q)),
        keys: embeddings.map(x => project(x, weights.k)),
        values: embeddings.map(x => project(x, weights.v))
      };
    });

    function attend(queryIndex, head = 0) {
      if (!Number.isInteger(queryIndex) || queryIndex < 0 || queryIndex >= tokens.length) {
        throw new RangeError('Query index must identify a token.');
      }
      if (!Number.isInteger(head) || head < 0 || head >= heads.length) {
        throw new RangeError('Head index must be between 0 and 3.');
      }
      const { queries, keys, values } = heads[head];
      const query = queries[queryIndex];
      const keyScores = keys.map(key => dot(query, key) / Math.sqrt(HEAD_DIMENSION));
      const maximum = Math.max(...keyScores);
      const exponents = keyScores.map(score => Math.exp(score - maximum));
      const total = exponents.reduce((sum, value) => sum + value, 0);
      const weights = exponents.map(value => value / total);
      const context = Array.from({ length: HEAD_DIMENSION }, (_, dimension) =>
        weights.reduce((sum, weight, index) => sum + weight * values[index][dimension], 0));
      return {
        weights, query: query.slice(), keyScores, context, head, queryIndex,
        keys: keys.map(key => key.slice()), values: values.map(value => value.slice())
      };
    }
    return { tokens: Object.freeze(tokens), headCount: heads.length, attend };
  }
  window.SelfAttentionModel = Object.freeze({ create });
})();
