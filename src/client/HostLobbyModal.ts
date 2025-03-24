import { LitElement, html } from "lit";
import { customElement, query, property, state } from "lit/decorators.js";
import { Difficulty, GameMapType, GameType } from "../core/game/Game";
import { GameConfig, GameInfo } from "../core/Schemas";
import { consolex } from "../core/Consolex";
import "./components/Difficulties";
import "./components/baseComponents/Modal";
import { DifficultyDescription } from "./components/Difficulties";
import "./components/Maps";
import randomMap from "../../resources/images/RandomMap.png";
import { generateID } from "../core/Util";
import { getServerConfigFromClient } from "../core/configuration/ConfigLoader";
import { JoinLobbyEvent } from "./Main";

@customElement("host-lobby-modal")
export class HostLobbyModal extends LitElement {
  @query("o-modal") private modalEl!: HTMLElement & {
    open: () => void;
    close: () => void;
  };
  @state() private selectedMap: GameMapType = GameMapType.World;
  @state() private selectedDifficulty: Difficulty = Difficulty.Medium;
  @state() private disableNPCs = false;
  @state() private disableNukes: boolean = false;
  @state() private bots: number = 400;
  @state() private infiniteGold: boolean = false;
  @state() private infiniteTroops: boolean = false;
  @state() private instantBuild: boolean = false;
  @state() private lobbyId = "";
  @state() private copySuccess = false;
  @state() private players: string[] = [];
  @state() private useRandomMap: boolean = false;

  private playersInterval = null;
  // Add a new timer for debouncing bot changes
  private botsUpdateTimer: number | null = null;

  render() {
    return html`
      <o-modal title="Private lobby">
        <div class="lobby-id-box">
          <button
            class="lobby-id-button"
            @click=${this.copyToClipboard}
            ?disabled=${this.copySuccess}
          >
            <span class="lobby-id">${this.lobbyId}</span>
            ${this.copySuccess
              ? html`<span class="copy-success-icon">✓</span>`
              : html`
                  <svg
                    class="clipboard-icon"
                    stroke="currentColor"
                    fill="currentColor"
                    stroke-width="0"
                    viewBox="0 0 512 512"
                    height="18px"
                    width="18px"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M296 48H176.5C154.4 48 136 65.4 136 87.5V96h-7.5C106.4 96 88 113.4 88 135.5v288c0 22.1 18.4 40.5 40.5 40.5h208c22.1 0 39.5-18.4 39.5-40.5V416h8.5c22.1 0 39.5-18.4 39.5-40.5V176L296 48zm0 44.6l83.4 83.4H296V92.6zm48 330.9c0 4.7-3.4 8.5-7.5 8.5h-208c-4.4 0-8.5-4.1-8.5-8.5v-288c0-4.1 3.8-7.5 8.5-7.5h7.5v255.5c0 22.1 10.4 32.5 32.5 32.5H344v7.5zm48-48c0 4.7-3.4 8.5-7.5 8.5h-208c-4.4 0-8.5-4.1-8.5-8.5v-288c0-4.1 3.8-7.5 8.5-7.5H264v128h128v167.5z"
                    ></path>
                  </svg>
                `}
          </button>
        </div>
        <div class="options-layout">
          <!-- Map Selection -->
          <div class="options-section">
            <div class="option-title">Map</div>
            <div class="option-cards">
              ${Object.entries(GameMapType)
                .filter(([key]) => isNaN(Number(key)))
                .map(
                  ([key, value]) => html`
                    <div @click=${() => this.handleMapSelection(value)}>
                      <map-display
                        .mapKey=${key}
                        .selected=${!this.useRandomMap &&
                        this.selectedMap === value}
                      ></map-display>
                    </div>
                  `,
                )}
              <div
                class="option-card random-map ${this.useRandomMap
                  ? "selected"
                  : ""}"
                @click=${this.handleRandomMapToggle}
              >
                <div class="option-image">
                  <img
                    src=${randomMap}
                    alt="Random Map"
                    style="width:100%; aspect-ratio: 4/2; object-fit:cover; border-radius:8px;"
                  />
                </div>
                <div class="option-card-title">Random</div>
              </div>
            </div>
          </div>

          <!-- Difficulty Selection -->
          <div class="options-section">
            <div class="option-title">Difficulty</div>
            <div class="option-cards">
              ${Object.entries(Difficulty)
                .filter(([key]) => isNaN(Number(key)))
                .map(
                  ([key, value]) => html`
                    <div
                      class="option-card ${this.selectedDifficulty === value
                        ? "selected"
                        : ""}"
                      @click=${() => this.handleDifficultySelection(value)}
                    >
                      <difficulty-display
                        .difficultyKey=${key}
                      ></difficulty-display>
                      <p class="option-card-title">
                        ${DifficultyDescription[key]}
                      </p>
                    </div>
                  `,
                )}
            </div>
          </div>

          <!-- Game Options -->
          <div class="options-section">
            <div class="option-title">Options</div>
            <div class="option-cards">
              <label for="private-lobby-bots-count" class="option-card">
                <input
                  type="range"
                  id="private-lobby-bots-count"
                  min="0"
                  max="400"
                  step="1"
                  @input=${this.handleBotsChange}
                  @change=${this.handleBotsChange}
                  .value="${String(this.bots)}"
                />
                <div class="option-card-title">
                  Bots: ${this.bots == 0 ? "Disabled" : this.bots}
                </div>
              </label>

              <label
                for="private-lobby-disable-npcd"
                class="option-card ${this.disableNPCs ? "selected" : ""}"
              >
                <div class="checkbox-icon"></div>
                <input
                  type="checkbox"
                  id="private-lobby-disable-npcd"
                  @change=${this.handleDisableNPCsChange}
                  .checked=${this.disableNPCs}
                />
                <div class="option-card-title">Disable Nations</div>
              </label>

              <label
                for="private-lobby-instant-build"
                class="option-card ${this.instantBuild ? "selected" : ""}"
              >
                <div class="checkbox-icon"></div>
                <input
                  type="checkbox"
                  id="private-lobby-instant-build"
                  @change=${this.handleInstantBuildChange}
                  .checked=${this.instantBuild}
                />
                <div class="option-card-title">Instant build</div>
              </label>

              <label
                for="private-lobby-infinite-gold"
                class="option-card ${this.infiniteGold ? "selected" : ""}"
              >
                <div class="checkbox-icon"></div>
                <input
                  type="checkbox"
                  id="private-lobby-infinite-gold"
                  @change=${this.handleInfiniteGoldChange}
                  .checked=${this.infiniteGold}
                />
                <div class="option-card-title">Infinite gold</div>
              </label>

              <label
                for="private-lobby-infinite-troops"
                class="option-card ${this.infiniteTroops ? "selected" : ""}"
              >
                <div class="checkbox-icon"></div>
                <input
                  type="checkbox"
                  id="private-lobby-infinite-troops"
                  @change=${this.handleInfiniteTroopsChange}
                  .checked=${this.infiniteTroops}
                />
                <div class="option-card-title">Infinite troops</div>
              </label>
              <label
                for="private-lobby-disable-nukes"
                class="option-card ${this.disableNukes ? "selected" : ""}"
              >
                <div class="checkbox-icon"></div>
                <input
                  type="checkbox"
                  id="disable-nukes"
                  @change=${this.handleDisableNukesChange}
                  .checked=${this.disableNukes}
                />
                <div class="option-card-title">Disable Nukes</div>
              </label>
            </div>
          </div>

          <!-- Lobby Selection -->
          <div class="options-section">
            <div class="option-title">
              ${this.players.length}
              ${this.players.length === 1 ? "Player" : "Players"}
            </div>

            <div class="players-list">
              ${this.players.map(
                (player) => html`<span class="player-tag">${player}</span>`,
              )}
            </div>
          </div>
        </div>
        <div class="flex justify-center">
          <o-button
            .title=${this.players.length === 1
              ? "Waiting for players..."
              : "Start Game"}
            ?disable=${this.players.length < 2}
            @click=${this.startGame}
            block
          >
          </o-button>
        </div>
      </o-modal>
    `;
  }

  createRenderRoot() {
    return this;
  }

  public open() {
    createLobby()
      .then((lobby) => {
        this.lobbyId = lobby.gameID;
        // join lobby
      })
      .then(() => {
        this.dispatchEvent(
          new CustomEvent("join-lobby", {
            detail: {
              gameID: this.lobbyId,
            } as JoinLobbyEvent,
            bubbles: true,
            composed: true,
          }),
        );
      });
    this.modalEl?.open();
    this.playersInterval = setInterval(() => this.pollPlayers(), 1000);
  }

  public close() {
    this.modalEl?.close();
    this.copySuccess = false;
    if (this.playersInterval) {
      clearInterval(this.playersInterval);
      this.playersInterval = null;
    }
    // Clear any pending bot updates
    if (this.botsUpdateTimer !== null) {
      clearTimeout(this.botsUpdateTimer);
      this.botsUpdateTimer = null;
    }
  }

  private async handleRandomMapToggle() {
    this.useRandomMap = true;
    this.putGameConfig();
  }

  private async handleMapSelection(value: GameMapType) {
    this.selectedMap = value;
    this.useRandomMap = false;
    this.putGameConfig();
  }

  private async handleDifficultySelection(value: Difficulty) {
    this.selectedDifficulty = value;
    this.putGameConfig();
  }

  // Modified to include debouncing
  private handleBotsChange(e: Event) {
    const value = parseInt((e.target as HTMLInputElement).value);
    if (isNaN(value) || value < 0 || value > 400) {
      return;
    }

    // Update the display value immediately
    this.bots = value;

    // Clear any existing timer
    if (this.botsUpdateTimer !== null) {
      clearTimeout(this.botsUpdateTimer);
    }

    // Set a new timer to call putGameConfig after 300ms of inactivity
    this.botsUpdateTimer = window.setTimeout(() => {
      this.putGameConfig();
      this.botsUpdateTimer = null;
    }, 300);
  }

  private handleInstantBuildChange(e: Event) {
    this.instantBuild = Boolean((e.target as HTMLInputElement).checked);
    this.putGameConfig();
  }

  private handleInfiniteGoldChange(e: Event) {
    this.infiniteGold = Boolean((e.target as HTMLInputElement).checked);
    this.putGameConfig();
  }

  private handleInfiniteTroopsChange(e: Event) {
    this.infiniteTroops = Boolean((e.target as HTMLInputElement).checked);
    this.putGameConfig();
  }
  private handleDisableNukesChange(e: Event) {
    this.disableNukes = Boolean((e.target as HTMLInputElement).checked);
  }

  private async handleDisableNPCsChange(e: Event) {
    this.disableNPCs = Boolean((e.target as HTMLInputElement).checked);
    consolex.log(`updating disable npcs to ${this.disableNPCs}`);
    this.putGameConfig();
  }

  private async putGameConfig() {
    const config = await getServerConfigFromClient();
    const response = await fetch(
      `${window.location.origin}/${config.workerPath(this.lobbyId)}/api/game/${this.lobbyId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameMap: this.selectedMap,
          difficulty: this.selectedDifficulty,
          disableNPCs: this.disableNPCs,
          disableNukes: this.disableNukes,
          bots: this.bots,
          infiniteGold: this.infiniteGold,
          infiniteTroops: this.infiniteTroops,
          instantBuild: this.instantBuild,
        } as GameConfig),
      },
    );
  }

  private getRandomMap(): GameMapType {
    const maps = Object.values(GameMapType);
    const randIdx = Math.floor(Math.random() * maps.length);
    return maps[randIdx] as GameMapType;
  }

  private async startGame() {
    if (this.useRandomMap) {
      this.selectedMap = this.getRandomMap();
    }

    await this.putGameConfig();
    consolex.log(
      `Starting private game with map: ${GameMapType[this.selectedMap]} ${this.useRandomMap ? " (Randomly selected)" : ""}`,
    );
    this.close();
    const config = await getServerConfigFromClient();
    const response = await fetch(
      `${window.location.origin}/${config.workerPath(this.lobbyId)}/api/start_game/${this.lobbyId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  private async copyToClipboard() {
    try {
      //TODO: Convert id to url and copy
      await navigator.clipboard.writeText(
        `${location.origin}/join/${this.lobbyId}`,
      );
      this.copySuccess = true;
      setTimeout(() => {
        this.copySuccess = false;
      }, 2000);
    } catch (err) {
      consolex.error(`Failed to copy text: ${err}`);
    }
  }

  private async pollPlayers() {
    const config = await getServerConfigFromClient();
    fetch(`/${config.workerPath(this.lobbyId)}/api/game/${this.lobbyId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then((data: GameInfo) => {
        console.log(`got response: ${data}`);
        this.players = data.clients.map((p) => p.username);
      });
  }
}

async function createLobby(): Promise<GameInfo> {
  const config = await getServerConfigFromClient();
  try {
    const id = generateID();
    const response = await fetch(
      `/${config.workerPath(id)}/api/create_game/${id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // body: JSON.stringify(data), // Include this if you need to send data
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    consolex.log("Success:", data);

    return data as GameInfo;
  } catch (error) {
    consolex.error("Error creating lobby:", error);
    throw error; // Re-throw the error so the caller can handle it
  }
}
