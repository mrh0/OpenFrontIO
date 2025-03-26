import {
  AllPlayers,
  Cell,
  Game,
  NukeType,
  nukeTypes,
  Player,
  PlayerType,
  UnitType,
} from "../../../core/game/Game";
import { PseudoRandom } from "../../../core/PseudoRandom";
import { Theme } from "../../../core/configuration/Config";
import { Layer } from "./Layer";
import { TransformHandler } from "../TransformHandler";
import traitorIcon from "../../../../resources/images/TraitorIcon.svg";
import allianceIcon from "../../../../resources/images/AllianceIcon.svg";
import allianceRequestIcon from "../../../../resources/images/AllianceRequestIcon.svg";
import crownIcon from "../../../../resources/images/CrownIcon.svg";
import targetIcon from "../../../../resources/images/TargetIcon.svg";
import embargoIcon from "../../../../resources/images/EmbargoIcon.svg";
import nukeWhiteIcon from "../../../../resources/images/NukeIconWhite.svg";
import nukeRedIcon from "../../../../resources/images/NukeIconRed.svg";
import { ClientID } from "../../../core/Schemas";
import { GameView, PlayerView } from "../../../core/game/GameView";
import { createCanvas, renderTroops } from "../../Utils";
import { sanitize } from "../../../core/Util";

class RenderInfo {
  public icons: Map<string, HTMLImageElement> = new Map(); // Track icon elements

  constructor(
    public player: PlayerView,
    public lastRenderCalc: number,
    public location: Cell,
    public fontSize: number,
    public fontColor: string,
    public element: HTMLElement,
  ) {}
}

export class NameLayer implements Layer {
  private canvas: HTMLCanvasElement;
  private lastChecked = 0;
  private renderCheckRate = 100;
  private renderRefreshRate = 500;
  private rand = new PseudoRandom(10);
  private renders: RenderInfo[] = [];
  private seenPlayers: Set<PlayerView> = new Set();
  private traitorIconImage: HTMLImageElement;
  private allianceRequestIconImage: HTMLImageElement;
  private allianceIconImage: HTMLImageElement;
  private targetIconImage: HTMLImageElement;
  private crownIconImage: HTMLImageElement;
  private embargoIconImage: HTMLImageElement;
  private nukeWhiteIconImage: HTMLImageElement;
  private nukeRedIconImage: HTMLImageElement;
  private container: HTMLDivElement;
  private myPlayer: PlayerView | null = null;
  private firstPlace: PlayerView | null = null;
  private theme: Theme = this.game.config().theme();

  constructor(
    private game: GameView,
    private transformHandler: TransformHandler,
    private clientID: ClientID,
  ) {
    this.traitorIconImage = new Image();
    this.traitorIconImage.src = traitorIcon;
    this.allianceIconImage = new Image();
    this.allianceIconImage.src = allianceIcon;
    this.allianceRequestIconImage = new Image();
    this.allianceRequestIconImage.src = allianceRequestIcon;
    this.crownIconImage = new Image();
    this.crownIconImage.src = crownIcon;
    this.targetIconImage = new Image();
    this.targetIconImage.src = targetIcon;
    this.embargoIconImage = new Image();
    this.embargoIconImage.src = embargoIcon;
    this.nukeWhiteIconImage = new Image();
    this.nukeWhiteIconImage.src = nukeWhiteIcon;
    this.nukeRedIconImage = new Image();
    this.nukeRedIconImage.src = nukeRedIcon;
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  shouldTransform(): boolean {
    return false;
  }

  redraw() {
    this.theme = this.game.config().theme();
  }

  public init() {
    this.canvas = createCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
    this.resizeCanvas();

    this.container = document.createElement("div");
    this.container.style.position = "fixed";
    this.container.style.left = "50%";
    this.container.style.top = "50%";
    this.container.style.pointerEvents = "none";
    this.container.style.zIndex = "2";
    document.body.appendChild(this.container);
  }

  public tick() {
    if (this.game.ticks() % 10 != 0) {
      return;
    }
    const sorted = this.game
      .playerViews()
      .sort((a, b) => b.numTilesOwned() - a.numTilesOwned());
    if (sorted.length > 0) {
      this.firstPlace = sorted[0];
    }

    for (const player of this.game.playerViews()) {
      if (player.isAlive()) {
        if (!this.seenPlayers.has(player)) {
          this.seenPlayers.add(player);
          this.renders.push(
            new RenderInfo(
              player,
              0,
              null,
              0,
              "",
              this.createPlayerElement(player),
            ),
          );
        }
      }
    }
  }

  public renderLayer(mainContex: CanvasRenderingContext2D) {
    const screenPosOld = this.transformHandler.worldToScreenCoordinates(
      new Cell(0, 0),
    );
    const screenPos = new Cell(
      screenPosOld.x - window.innerWidth / 2,
      screenPosOld.y - window.innerHeight / 2,
    );
    this.container.style.transform = `translate(${screenPos.x}px, ${screenPos.y}px) scale(${this.transformHandler.scale})`;

    const now = Date.now();
    if (now > this.lastChecked + this.renderCheckRate) {
      this.lastChecked = now;
      for (const render of this.renders) {
        this.renderPlayerInfo(render);
      }
    }

    mainContex.drawImage(
      this.canvas,
      0,
      0,
      mainContex.canvas.width,
      mainContex.canvas.height,
    );
  }

  private createPlayerElement(player: PlayerView): HTMLDivElement {
    const element = document.createElement("div");
    element.style.position = "absolute";
    element.style.display = "flex";
    element.style.flexDirection = "column";
    element.style.alignItems = "center";
    element.style.gap = "0px";

    const iconsDiv = document.createElement("div");
    iconsDiv.classList.add("player-icons");
    iconsDiv.style.display = "flex";
    iconsDiv.style.gap = "4px";
    iconsDiv.style.justifyContent = "center";
    iconsDiv.style.alignItems = "center";
    iconsDiv.style.zIndex = "2";
    iconsDiv.style.opacity = "0.8";
    element.appendChild(iconsDiv);

    const nameDiv = document.createElement("div");
    if (player.flag()) {
      const flagImg = document.createElement("img");
      flagImg.classList.add("player-flag");
      flagImg.style.opacity = "0.8";
      flagImg.src = "/flags/" + player.flag() + ".svg";
      flagImg.style.zIndex = "1";
      flagImg.style.aspectRatio = "3/4";
      nameDiv.appendChild(flagImg);
    }
    nameDiv.classList.add("player-name");
    nameDiv.style.color = this.theme.textColor(player.info());
    nameDiv.style.fontFamily = this.theme.font();
    nameDiv.style.whiteSpace = "nowrap";
    nameDiv.style.textOverflow = "ellipsis";
    nameDiv.style.zIndex = "3";
    nameDiv.style.display = "flex";
    nameDiv.style.justifyContent = "flex-end";
    nameDiv.style.alignItems = "center";

    const nameSpan = document.createElement("span");
    nameSpan.innerHTML = player.name();
    nameDiv.appendChild(nameSpan);
    element.appendChild(nameDiv);

    const troopsDiv = document.createElement("div");
    troopsDiv.classList.add("player-troops");
    troopsDiv.setAttribute("translate", "no");
    troopsDiv.textContent = renderTroops(player.troops());
    troopsDiv.style.color = this.theme.textColor(player.info());
    troopsDiv.style.fontFamily = this.theme.font();
    troopsDiv.style.zIndex = "3";
    troopsDiv.style.marginTop = "-5%";
    element.appendChild(troopsDiv);

    // Start off invisible so it doesn't flash at 0,0
    element.style.display = "none";

    this.container.appendChild(element);
    return element;
  }

  renderPlayerInfo(render: RenderInfo) {
    if (!render.player.nameLocation() || !render.player.isAlive()) {
      this.renders = this.renders.filter((r) => r != render);
      render.element.remove();
      return;
    }

    const oldLocation = render.location;
    render.location = new Cell(
      render.player.nameLocation().x,
      render.player.nameLocation().y,
    );

    // Calculate base size and scale
    const baseSize = Math.max(1, Math.floor(render.player.nameLocation().size));
    render.fontSize = Math.max(4, Math.floor(baseSize * 0.4));
    render.fontColor = this.theme.textColor(render.player.info());

    // Screen space calculations
    const size = this.transformHandler.scale * baseSize;
    if (size < 7 || !this.transformHandler.isOnScreen(render.location)) {
      render.element.style.display = "none";
      return;
    }
    render.element.style.display = "flex";

    // Throttle updates
    const now = Date.now();
    if (now - render.lastRenderCalc <= this.renderRefreshRate) {
      return;
    }
    render.lastRenderCalc = now + this.rand.nextInt(0, 100);

    // Update text sizes
    const nameDiv = render.element.querySelector(
      ".player-name",
    ) as HTMLDivElement;
    const flagDiv = render.element.querySelector(
      ".player-flag",
    ) as HTMLDivElement;
    const troopsDiv = render.element.querySelector(
      ".player-troops",
    ) as HTMLDivElement;
    nameDiv.style.fontSize = `${render.fontSize}px`;
    nameDiv.style.lineHeight = `${render.fontSize}px`;
    nameDiv.style.color = render.fontColor;
    if (flagDiv) {
      flagDiv.style.height = `${render.fontSize}px`;
    }
    troopsDiv.style.fontSize = `${render.fontSize}px`;
    troopsDiv.style.color = render.fontColor;
    troopsDiv.textContent = renderTroops(render.player.troops());

    // Handle icons
    const iconsDiv = render.element.querySelector(
      ".player-icons",
    ) as HTMLDivElement;
    const iconSize = Math.min(render.fontSize * 1.5, 48);
    const myPlayer = this.getPlayer();

    // Crown icon
    const existingCrown = iconsDiv.querySelector('[data-icon="crown"]');
    if (render.player === this.firstPlace) {
      if (!existingCrown) {
        iconsDiv.appendChild(
          this.createIconElement(
            this.crownIconImage.src,
            iconSize,
            "crown",
            false,
          ),
        );
      }
    } else if (existingCrown) {
      existingCrown.remove();
    }

    // Traitor icon
    const existingTraitor = iconsDiv.querySelector('[data-icon="traitor"]');
    if (render.player.isTraitor()) {
      if (!existingTraitor) {
        iconsDiv.appendChild(
          this.createIconElement(
            this.traitorIconImage.src,
            iconSize,
            "traitor",
          ),
        );
      }
    } else if (existingTraitor) {
      existingTraitor.remove();
    }

    // Alliance icon
    const existingAlliance = iconsDiv.querySelector('[data-icon="alliance"]');
    if (myPlayer != null && myPlayer.isAlliedWith(render.player)) {
      if (!existingAlliance) {
        iconsDiv.appendChild(
          this.createIconElement(
            this.allianceIconImage.src,
            iconSize,
            "alliance",
          ),
        );
      }
    } else if (existingAlliance) {
      existingAlliance.remove();
    }

    // Alliance request icon
    const data = '[data-icon="alliance-request"]';
    const existingRequestAlliance = iconsDiv.querySelector(data);
    if (myPlayer != null && render.player.isRequestingAllianceWith(myPlayer)) {
      if (!existingRequestAlliance) {
        iconsDiv.appendChild(
          this.createIconElement(
            this.allianceRequestIconImage.src,
            iconSize,
            "alliance-request",
          ),
        );
      }
    } else if (existingRequestAlliance) {
      existingRequestAlliance.remove();
    }

    // Target icon
    const existingTarget = iconsDiv.querySelector('[data-icon="target"]');
    if (
      myPlayer != null &&
      new Set(myPlayer.transitiveTargets()).has(render.player)
    ) {
      if (!existingTarget) {
        iconsDiv.appendChild(
          this.createIconElement(
            this.targetIconImage.src,
            iconSize,
            "target",
            true,
          ),
        );
      }
    } else if (existingTarget) {
      existingTarget.remove();
    }

    function lerp(a: number, b: number, alpha: number) {
      return a + alpha * (b - a);
    }

    // Target icon
    const existingAttackTarget = iconsDiv.querySelector(
      '[data-icon="attack-target"]',
    );
    if (
      myPlayer != null &&
      new Set(myPlayer.incomingAttacks().map((a) => a.attackerID)).has(
        render.player.smallID(),
      )
    ) {
      if (!existingAttackTarget) {
        const icon = this.createIconElement(
          this.traitorIconImage.src,
          iconSize,
          "attack-target",
          true,
        );
        const ax = myPlayer.nameLocation().x;
        const ay = myPlayer.nameLocation().y;
        const bx = render.player.nameLocation().x;
        const by = render.player.nameLocation().y;

        const length = Math.hypot(by - ay, bx - ax);
        const deg = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
        icon.style.transform = `translate(${lerp(ax, bx, 0.5) - render.location.x}px, ${lerp(ay, ay, 0.5) - render.location.y}px) translate(-50%, -50%) scale(${1})`;
        iconsDiv.appendChild(icon);
      }
    } else if (existingAttackTarget) {
      existingAttackTarget.remove();
    }

    // Emoji handling
    const existingEmoji = iconsDiv.querySelector('[data-icon="emoji"]');
    const emojis = render.player
      .outgoingEmojis()
      .filter(
        (emoji) =>
          emoji.recipientID == AllPlayers ||
          emoji.recipientID == myPlayer?.smallID(),
      );

    if (this.game.config().userSettings().emojis() && emojis.length > 0) {
      if (!existingEmoji) {
        const emojiDiv = document.createElement("div");
        emojiDiv.setAttribute("data-icon", "emoji");
        emojiDiv.style.fontSize = `${iconSize}px`;
        emojiDiv.textContent = emojis[0].message;
        emojiDiv.style.position = "absolute";
        emojiDiv.style.top = "50%";
        emojiDiv.style.transform = "translateY(-50%)";
        iconsDiv.appendChild(emojiDiv);
      }
    } else if (existingEmoji) {
      existingEmoji.remove();
    }

    const existingEmbargo = iconsDiv.querySelector('[data-icon="embargo"]');
    const hasEmbargo =
      myPlayer &&
      (render.player.hasEmbargoAgainst(myPlayer) ||
        myPlayer.hasEmbargoAgainst(render.player));
    if (myPlayer && hasEmbargo) {
      if (!existingEmbargo) {
        iconsDiv.appendChild(
          this.createIconElement(
            this.embargoIconImage.src,
            iconSize,
            "embargo",
          ),
        );
      }
    } else if (existingEmbargo) {
      existingEmbargo.remove();
    }

    const nukesSentByOtherPlayer = this.game.units().filter((unit) => {
      const isSendingNuke = render.player.id() == unit.owner().id();
      const notMyPlayer = !myPlayer || unit.owner().id() != myPlayer.id();
      return (
        nukeTypes.includes(unit.type()) &&
        isSendingNuke &&
        notMyPlayer &&
        unit.isActive()
      );
    });
    const isMyPlayerTarget = nukesSentByOtherPlayer.find((unit) => {
      const detonationDst = unit.detonationDst();
      const targetId = this.game.owner(detonationDst).id();
      return myPlayer && targetId == this.myPlayer.id();
    });
    const existingNuke = iconsDiv.querySelector(
      '[data-icon="nuke"]',
    ) as HTMLImageElement;

    if (existingNuke) {
      if (nukesSentByOtherPlayer.length == 0) {
        existingNuke.remove();
      } else if (
        isMyPlayerTarget &&
        existingNuke.src != this.nukeRedIconImage.src
      ) {
        existingNuke.src = this.nukeRedIconImage.src;
      } else if (
        !isMyPlayerTarget &&
        existingNuke.src != this.nukeWhiteIconImage.src
      ) {
        existingNuke.src = this.nukeWhiteIconImage.src;
      }
    } else if (nukesSentByOtherPlayer.length > 0) {
      if (!existingNuke) {
        const icon = isMyPlayerTarget
          ? this.nukeRedIconImage.src
          : this.nukeWhiteIconImage.src;
        iconsDiv.appendChild(this.createIconElement(icon, iconSize, "nuke"));
      }
    }
    // Update all icon sizes
    const icons = iconsDiv.getElementsByTagName("img");
    for (const icon of icons) {
      icon.style.width = `${iconSize}px`;
      icon.style.height = `${iconSize}px`;
    }

    // Position element with scale
    if (render.location && render.location != oldLocation) {
      const scale = Math.min(baseSize * 0.25, 3);
      render.element.style.transform = `translate(${render.location.x}px, ${render.location.y}px) translate(-50%, -50%) scale(${scale})`;
    }
  }

  private createIconElement(
    src: string,
    size: number,
    id: string,
    center: boolean = false,
  ): HTMLImageElement {
    const icon = document.createElement("img");
    icon.src = src;
    icon.style.width = `${size}px`;
    icon.style.height = `${size}px`;
    icon.setAttribute("data-icon", id);
    if (center) {
      icon.style.position = "absolute";
      icon.style.top = "50%";
      icon.style.transform = "translateY(-50%)";
    }
    return icon;
  }

  private getPlayer(): PlayerView | null {
    if (this.myPlayer != null) {
      return this.myPlayer;
    }
    this.myPlayer = this.game
      .playerViews()
      .find((p) => p.clientID() == this.clientID);
    return this.myPlayer;
  }
}
