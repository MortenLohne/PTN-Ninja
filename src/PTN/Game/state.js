import Marray from "marray";

import Piece from "../Piece";
import Square from "../Square";

import { defaults, last } from "lodash";
import memoize from "./memoize";

export default class GameState {
  constructor(game, state = null) {
    this.game = game;

    defaults(this, state, {
      targetBranch: "",
      plyID: -1,
      plyIsDone: false
    });

    Object.defineProperty(this, "plies", {
      get: memoize(this.getPlies, this.branchKey)
    });
    Object.defineProperty(this, "plyIDs", {
      get: memoize(this.getPlyIDs, this.branchKey)
    });
    Object.defineProperty(this, "moves", {
      get: memoize(this.getMoves, this.branchKey)
    });
    Object.defineProperty(this, "move", {
      get: memoize(this.getMove, () => this.plyID)
    });
    Object.defineProperty(this, "branch", {
      get: memoize(this.getBranch, () => this.plyID)
    });
    Object.defineProperty(this, "number", {
      get: memoize(this.getNumber, () => this.plyID)
    });
    Object.defineProperty(this, "board", {
      get: memoize(this.getBoard, () => JSON.stringify(this.boardPly)),
      set: this.setBoard
    });
    Object.defineProperty(this, "tps", {
      get: memoize(this.getTPS, () => JSON.stringify(this.boardPly))
    });

    this.selected = {
      pieces: [],
      squares: [],
      moveset: [],
      initialCount: 0
    };

    this.pieces = {
      all: {
        1: { flat: [], cap: [] },
        2: { flat: [], cap: [] },
        byID: {}
      },
      played: {
        1: { flat: [], cap: [] },
        2: { flat: [], cap: [] }
      }
    };
    [1, 2].forEach(color => {
      ["flat", "cap"].forEach(type => {
        for (
          let index = 0;
          index < this.game.pieceCounts[color][type];
          index++
        ) {
          const id = color + type[0] + (index + 1);
          const piece = new Piece({
            game: this.game,
            id,
            index,
            color,
            type
          });
          this.pieces.all[color][type][index] = piece;
          this.pieces.all.byID[id] = piece;
        }
      });
    });

    this.squares = new Marray.two(
      this.game.size,
      this.game.size,
      (y, x) => new Square(x, y, this.game.size)
    );
    this.squares.forEach(row => {
      row.forEach(square => {
        if (!square.edges.N) {
          square.neighbors.N = this.squares[square.y + 1][square.x];
          square.neighbors.push(square.neighbors.N);
        }
        if (!square.edges.S) {
          square.neighbors.S = this.squares[square.y - 1][square.x];
          square.neighbors.push(square.neighbors.S);
        }
        if (!square.edges.E) {
          square.neighbors.E = this.squares[square.y][square.x + 1];
          square.neighbors.push(square.neighbors.E);
        }
        if (!square.edges.W) {
          square.neighbors.W = this.squares[square.y][square.x - 1];
          square.neighbors.push(square.neighbors.W);
        }
      });
    });
  }

  branchKey() {
    if (this.ply) {
      return (
        `${this.targetBranch}${this.game.plies.length}` +
        this.ply.isInBranch(this.targetBranch)
      );
    } else {
      return this.plyID;
    }
  }

  getPlies() {
    if (!this.game.plies.length) {
      return [];
    } else if (!this.ply) {
      return this.game.plies;
    } else if (
      (!this.ply.id && !this.plyIsDone) ||
      this.ply.isInBranch(this.targetBranch)
    ) {
      return this.game.plies.filter(
        ply => ply && ply.isInBranch(this.targetBranch)
      );
    } else {
      return this.game.plies.filter(ply => ply && ply.isInBranch(this.branch));
    }
  }

  getPlyIDs() {
    return this.plies.map(ply => ply.id);
  }

  getMoves() {
    let moves = [];
    if (this.plies) {
      this.plies.forEach(ply => {
        if (ply.player === 2 || !ply.move.ply2) {
          moves.push(ply.move);
        }
      });
    }
    return moves.length ? moves : this.game.moves;
  }

  get ply() {
    return this.game.plies[this.plyID] || this.game.plies[0] || null;
  }

  getMove() {
    return this.ply ? this.ply.move : this.moves[0];
  }

  getBranch() {
    return this.move ? this.move.branch : "";
  }

  getNumber() {
    return this.move ? this.move.number : this.game.firstMoveNumber;
  }

  playPiece(color, type, square) {
    const isStanding = /S|wall/.test(type);
    if (!(type in this.game.pieceCounts[1])) {
      type = type === "C" ? "cap" : "flat";
    }
    const piece = this.pieces.all[color][type][
      this.pieces.played[color][type].length
    ];
    if (piece) {
      piece.isStanding = isStanding;
      this.pieces.played[color][type].push(piece);
      if ("z" in square) {
        // Set via piece state
        piece.square = this.squares[square.y][square.x];
        piece.square[square.z] = piece;
      } else {
        // Set via square
        piece.square = square;
        square.push(piece);
      }
      return piece;
    }
    return null;
  }

  unplayPiece(square) {
    const piece = square.pop();
    if (piece) {
      piece.isStanding = false;
      const pieces = this.pieces.played[piece.color][piece.type];
      if (piece.index !== pieces.length - 1) {
        // Swap indices with the top of the stack
        const lastPiece = pieces.pop();
        pieces.splice(piece.index, 1, lastPiece);
        [piece.index, lastPiece.index] = [lastPiece.index, piece.index];
        this.pieces.all[piece.color][piece.type][piece.index] = piece;
        this.pieces.all[piece.color][piece.type][lastPiece.index] = lastPiece;
      } else {
        this.pieces.played[piece.color][piece.type].pop();
      }
      piece.square = null;
      return piece;
    }
    return null;
  }

  clearBoard() {
    this.squares.forEach(row =>
      row.forEach(square =>
        square.splice(0, square.length).forEach(piece => (piece.square = null))
      )
    );
    this.pieces.played[1].flat = [];
    this.pieces.played[1].cap = [];
    this.pieces.played[2].flat = [];
    this.pieces.played[2].cap = [];
  }

  getBoard() {
    return {
      1: {
        flat: this.pieces.played[1].flat.map(piece => piece.state),
        cap: this.pieces.played[1].cap.map(piece => piece.state)
      },
      2: {
        flat: this.pieces.played[2].flat.map(piece => piece.state),
        cap: this.pieces.played[2].cap.map(piece => piece.state)
      }
    };
  }

  getTPS(player = this.turn, number = null) {
    const grid = this.squares
      .map(row => {
        return row
          .map(square => {
            if (square.length) {
              return square.map(piece => piece.color + piece.typeCode).join("");
            } else {
              return "x";
            }
          })
          .join(",");
      })
      .reverse()
      .join("/")
      .replace(/x((,x)+)/g, spaces => "x" + (1 + spaces.length) / 2);

    if (number === null) {
      const ply = this.boardPly ? this.game.plies[this.boardPly.id] : null;
      number = ply
        ? ply.move.number + 1 * (ply.player === 2 && this.plyIsDone)
        : this.game.firstMoveNumber;
    }

    return `${grid} ${player} ${number}`;
  }

  setBoard(pieces, plyID, plyIsDone) {
    this.clearBoard();
    [1, 2].forEach(color =>
      ["flat", "cap"].forEach(type => {
        pieces[color][type].forEach(state => {
          this.playPiece(color, state.type, state);
        });
      })
    );
    this.plyID = plyID;
    this.plyIsDone = plyIsDone;
  }

  get boardPly() {
    let ply = this.ply;
    let isDone = this.plyIsDone;
    if (!this.plyIsDone && this.prevPly) {
      ply = this.prevPly;
      isDone = true;
    }
    if (!ply) {
      return null;
    }
    if (!isDone && ply.branches.length) {
      ply = ply.branches[0];
    }
    return { id: ply.id, isDone };
  }

  get min() {
    return {
      targetBranch: this.targetBranch,
      plyIndex: this.ply ? this.ply.index : 0,
      plyIsDone: this.plyIsDone
    };
  }

  get plyIndex() {
    return this.ply ? this.ply.index : -1;
  }

  set plyIndex(index) {
    if (this.plies.length > index) {
      this.plyID = this.plies[index].id;
    }
  }

  get isGameEnd() {
    return this.ply && this.plyIsDone && !!this.ply.result;
  }

  get isFirstMove() {
    return (
      (!this.game.hasTPS ||
        !(
          this.pieces.played[1].flat.length && this.pieces.played[2].flat.length
        )) &&
      this.number === 1 &&
      (!this.ply || this.ply.index < 1 || !this.plyIsDone)
    );
  }

  get turn() {
    if (this.ply) {
      if (this.isGameEnd) {
        return this.ply.player;
      } else {
        return this.plyIsDone
          ? this.ply.player === 1
            ? 2
            : 1
          : this.ply.player;
      }
    }
    return this.game.firstPlayer;
  }

  get player() {
    if (this.game.isLocal) {
      return this.turn;
    }
    return 1;
  }

  get color() {
    if (this.isFirstMove) {
      return this.turn === 1 ? 2 : 1;
    } else {
      return this.turn;
    }
  }

  get prevPly() {
    return this.ply && this.ply.index ? this.plies[this.ply.index - 1] : null;
  }

  get nextPly() {
    return this.ply && this.ply.index < this.plies.length - 1
      ? this.plies[this.ply.index + 1]
      : null;
  }

  get flats() {
    let flats = [0, 0];
    this.squares.forEach(row => {
      row.forEach(square => {
        if (square.length) {
          const piece = last(square);
          flats[piece.color - 1] += piece.isFlat;
        }
      });
    });
    return flats;
  }
}
