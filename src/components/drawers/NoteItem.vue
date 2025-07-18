<template>
  <div
    class="note-item q-py-xs"
    :class="{
      current,
      'q-pt-md': plyID < 0,
    }"
    :key="plyID"
    :ref="plyID"
  >
    <div
      v-if="$store.state.ui.showEval && evaluation !== null"
      class="evaluation"
      :class="{ p1: evaluation > 0, p2: evaluation < 0 }"
      :style="{ width: Math.abs(evaluation) + '%' }"
    />
    <div v-if="ply && plyID >= 0" class="ply-container">
      <Move
        :move="move"
        :player="player"
        separate-branch
        no-decoration
        class="q-px-md"
      >
        <template v-slot:plyTooltip>
          <PlyPreview
            :tps="ply.tpsAfter"
            :hl="ply.text"
            :options="$store.state.game.config"
          />
        </template>
      </Move>
      <q-item
        v-for="(pv, i) in pvs"
        :key="i"
        @mouseover="current ? highlight(pv) : null"
        @mouseout="current ? unhighlight() : null"
        @click="insertPV(i)"
        clickable
      >
        <q-item-label class="small">
          <Linenum :linenum="move.linenum" no-branch />
          <Ply
            v-for="(pvPly, j) in pv"
            :key="j"
            :ply="pvPly"
            @click.stop.prevent.capture="insertPV(i, j)"
          >
            <PlyPreview
              :tps="ply.tpsBefore"
              :plies="pv.slice(0, j + 1).map((p) => p.ptn)"
              :options="$store.state.game.config"
            />
          </Ply>
        </q-item-label>
      </q-item>
    </div>

    <Note
      v-for="(comment, index) in notes"
      :key="`message-${plyID}-${index}`"
      :plyID="plyID"
      :index="index"
      :comment="comment"
      @edit="$emit('edit', $event)"
      @remove="$emit('remove', $event)"
      class="q-px-md"
    />
  </div>
</template>

<script>
import Note from "./Note";
import Move from "../PTN/Move";
import Linenum from "../PTN/Linenum";
import Ply from "../PTN/Ply";
import PlyPreview from "../controls/PlyPreview";
import { parsePV } from "../../utilities";

export default {
  name: "NoteItem",
  components: { Note, Move, Linenum, Ply, PlyPreview },
  props: {
    plyID: Number,
    notes: Array,
  },
  data() {
    return {
      message: "",
      editing: null,
    };
  },
  computed: {
    game() {
      return this.$store.state.game;
    },
    ply() {
      return this.game.ptn.allPlies[this.plyID];
    },
    move() {
      return this.ply ? this.game.ptn.allMoves[this.ply.move] : null;
    },
    player() {
      return this.ply ? this.ply.player : null;
    },
    current() {
      return (
        this.game.position.plyID === this.plyID ||
        (this.plyID < 0 &&
          (!this.game.position.ply ||
            (!this.game.position.ply.index && !this.game.position.plyIsDone)))
      );
    },
    evaluation() {
      return this.$store.state.game.comments.evaluations[this.plyID];
    },
    pvs() {
      let pvs = this.$store.state.game.comments.pvs[this.plyID];
      if (pvs) {
        return pvs.map(this.formatPV);
      }
      return null;
    },
  },
  methods: {
    remove({ plyID, index }) {
      this.$store.dispatch("game/REMOVE_NOTE", { plyID, index });
    },
    formatPV(pv) {
      return parsePV(this.ply.player, this.ply.color, pv);
    },
    highlight(pv) {
      this.$store.dispatch("game/HIGHLIGHT_SQUARES", pv[0].squares);
    },
    unhighlight() {
      this.$store.dispatch("game/HIGHLIGHT_SQUARES", null);
    },
    insertPV(pvIndex, plyIndex) {
      if (!this.pvs || !this.pvs[pvIndex]) {
        return;
      }
      let prev = 0;
      if (plyIndex === undefined) {
        plyIndex = this.pvs[pvIndex].length;
        prev = plyIndex - 1;
      }
      this.unhighlight();
      if (this.$store.state.game.position.plyID !== this.plyID) {
        this.$store.commit("game/GO_TO_PLY", {
          plyID: this.plyID,
          isDone: false,
        });
      } else if (this.$store.state.game.position.plyIsDone) {
        this.$store.commit("game/PREV", { half: true });
      }
      this.$store.dispatch("game/INSERT_PLIES", {
        plies: this.pvs[pvIndex].slice(0, plyIndex + 1).map((ply) => ply.text),
        prev,
      });
    },
  },
};
</script>

<style lang="scss">
.note-item {
  position: relative;

  &.current {
    background-color: $dim;
    body.panelDark & {
      background-color: $highlight;
    }
  }

  .evaluation {
    &.p1,
    &.p2 {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
    }
  }

  .q-message:not(:last-child) {
    margin-bottom: 3px;
    .q-message-text {
      border-radius: $generic-border-radius;
      min-height: 2em;
      &:before {
        display: none;
      }
    }
  }
  .ply-container {
    padding-bottom: 0.5em;
  }
}
</style>
