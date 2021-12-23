/* glossary:
   - subject: the first line of a commit
     - short subjects are <= 50 characters long
     - long subjects are 51..72 characters long
     - oversized subjects are >= 73 characters long
   - message: the body of a commit
     - starts on the third line of the file (1-indexed)
     - may be interspersed with comments
   - item: an issue or PR
   - change: how a file will change with this commit
     - either 'new file', 'modified', 'renamed' or 'deleted'
 */

const WHITE_SPACE = /[\t\f\v ]+/;
const NEWLINE = /\r?\n/;
const ANYTHING = /[^\n\r]+/;
const CHANGE = choice("new file", "modified", "renamed", "deleted");
const PREC = {
  NONSENSE: -1,
  PATH: 5,
  PATH_SEPARATOR_ARROW: 6,
  ITEM: 10,
  USER: 11,
  SUBJECT_FIRST_CHAR: 15,
  SUBJECT: 16,
};

const SCISSORS =
  /# -+ >8 -+\n# Do not modify or remove the line above.\n# Everything below it will be ignored./;

module.exports = grammar({
  name: "gitcommit",

  extras: ($) => [WHITE_SPACE],

  rules: {
    source: ($) =>
      seq(
        optional(choice($.comment, $.subject)),
        optional(seq(NEWLINE, repeat($._body_line)))
      ),

    _body_line: ($) =>
      choice(seq($.message, NEWLINE), seq($.comment, NEWLINE), NEWLINE),

    subject: ($) =>
      seq(
        token(prec(PREC.SUBJECT_FIRST_CHAR, /[^#\r\n]/)),
        optional(repeat(/[^\r\n]+/))
      ),

    message: ($) =>
      choice(
        seq(
          choice($.user, /[^\s]+/),
          optional(repeat(choice($.user, $.item, $._word)))
        )
      ),

    comment: ($) =>
      choice(
        alias(SCISSORS, $.scissors),
        seq(token.immediate("#"), optional($._comment_body))
      ),

    _comment_body: ($) =>
      choice(
        $.summary,
        $._branch_declaration,
        // fallback to regular comment words if the words are nonsense
        repeat1($._word)
      ),

    summary: ($) =>
      choice(
        seq(
          alias($._change_header, $.header),
          NEWLINE,
          repeat1(seq("#", $.change, NEWLINE)),
          optional("#")
        ),
        seq(
          $.header,
          NEWLINE,
          repeat1(seq("#", $.path, NEWLINE)),
          optional("#")
        )
      ),

    _change_header: ($) =>
      choice(
        seq("Changes", "to", "be", "committed", ":"),
        seq("Changes", "not", "staged", "for", "commit", ":")
      ),

    _branch_declaration: ($) =>
      choice(
        seq("On", "branch", alias($._word, $.branch)),
        seq(
          "Your",
          "branch",
          "is",
          "up",
          "to",
          "date",
          "with",
          "'",
          $.branch,
          "'."
        ),
        seq(
          "Your",
          "branch",
          "is",
          choice("ahead", "behind"),
          "of",
          "'",
          $.branch,
          "'",
          "by",
          /\d+/,
          /commits?/,
          "."
        ),
        seq(
          "You",
          "are",
          "currently",
          "rebasing",
          "branch",
          "'",
          $.branch,
          "'",
          "on",
          "'",
          $.commit,
          "'",
          "."
        ),
        seq("HEAD", "detached", "at", $.commit)
      ),

    header: ($) => seq(choice("Conflicts", seq("Untracked", "files")), ":"),

    change: ($) =>
      seq(
        field("kind", CHANGE),
        ":",
        $.path,
        optional(seq(token(prec(PREC.PATH_SEPARATOR_ARROW, "->")), $.path))
      ),

    commit: ($) => /[a-f0-9]{7,40}/,

    _word: ($) => token(prec(PREC.NONSENSE, /\S+/)),
    branch: ($) => /[^\.\s']+/,

    path: ($) => repeat1(token(prec(PREC.PATH, /\S+/))),

    user: ($) => token(prec(PREC.USER, /@[^\s@]+/)),
    item: ($) => token(prec(PREC.ITEM, /#\d+/)),
  },
});
