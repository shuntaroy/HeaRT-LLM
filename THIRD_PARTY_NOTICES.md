# Third-party notices

## `sociocom/prism-heart`

`web/public/heart-mark.png` is an unmodified copy of
`static/img/heart.png` from
[`sociocom/prism-heart`](https://github.com/sociocom/prism-heart) at commit
`bdbf1ac753233925da0e8ab8db35c13a33f8c9c1`.

The interface also adapts the upstream indigo, cyan time-scale, pastel lane,
and six-colour entity-mark palette as accessible CSS design tokens. No source
code, data fixture, or bundled frontend dependency was copied from that
repository.

The upstream repository includes the following MIT licence:

MIT License

Copyright (c) 2023 Social Computing Lab.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## `sociocom/prism-annotator`

The three Japanese PRISM v8 system prompts in
`web/worker/annotation/prompts.ts` are modified copies of:

- `src/prism_annotator/defaults/prompts/ja/entity_system.md`;
- `src/prism_annotator/defaults/prompts/ja/medical_relation_system.md`; and
- `src/prism_annotator/defaults/prompts/ja/time_relation_system.md`

from
[`sociocom/prism-annotator`](https://github.com/sociocom/prism-annotator) at
commit `6e2a38e4ce4f563be2fb92f7fa7b4fa29fc64e95`. HeaRT-LLM adds strict output
constraints and request-specific document-date context, and implements its own
TypeScript request, parsing, validation, and retry control flow.

At that immutable revision, the upstream
[`pyproject.toml`](https://github.com/sociocom/prism-annotator/blob/6e2a38e4ce4f563be2fb92f7fa7b4fa29fc64e95/pyproject.toml)
declares `license = "MIT"` and the MIT licence classifier, and lists Shuntaro
Yada as the package author. The upstream repository does not contain a root
licence file at that revision; the commit-pinned package metadata is retained
here as the durable upstream licence record.
