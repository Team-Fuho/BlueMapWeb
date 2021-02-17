import {MouseMoveControls} from "./mouse/MouseMoveControls";
import {MouseZoomControls} from "./mouse/MouseZoomControls";
import {MouseRotateControls} from "./mouse/MouseRotateControls";
import {MouseAngleControls} from "./mouse/MouseAngleControls";
import {MathUtils} from "three";
import {animate, EasingFunctions, softClamp, softMin} from "../../util/Utils";
import {MapHeightControls} from "./MapHeightControls";
import {KeyMoveControls} from "./keyboard/KeyMoveControls";
import {KeyAngleControls} from "./keyboard/KeyAngleControls";
import {KeyRotateControls} from "./keyboard/KeyRotateControls";
import {KeyZoomControls} from "./keyboard/KeyZoomControls";
import {TouchMoveControls} from "./touch/TouchMoveControls";
import {TouchRotateControls} from "./touch/TouchRotateControls";
import {TouchAngleControls} from "./touch/TouchAngleControls";
import {TouchZoomControls} from "./touch/TouchZoomControls";

const HALF_PI = Math.PI * 0.5;

export class MapControls {

    /**
     * @param rootElement {EventTarget}
     */
    constructor(rootElement) {
        this.rootElement = rootElement;
        this.manager = null;

        this.started = false;

        this.hammer = new Hammer.Manager(this.rootElement);
        this.initializeHammer();

        //controls
        this.mouseMove = new MouseMoveControls(this.rootElement, 0.002,0.3);
        this.mouseRotate = new MouseRotateControls(this.rootElement, 0.004, 0.3);
        this.mouseAngle = new MouseAngleControls(this.rootElement, 0.004, 0.3);
        this.mouseZoom = new MouseZoomControls(this.rootElement, 1, 0.2);

        this.keyMove = new KeyMoveControls(this.rootElement, 0.025, 0.2);
        this.keyRotate = new KeyRotateControls(this.rootElement, 0.06, 0.15);
        this.keyAngle = new KeyAngleControls(this.rootElement, 0.04, 0.15);
        this.keyZoom = new KeyZoomControls(this.rootElement, 0.2, 0.15);

        this.touchMove = new TouchMoveControls(this.hammer, 0.002,0.3);
        this.touchRotate = new TouchRotateControls(this.hammer, 0.0174533, 0.3);
        this.touchAngle = new TouchAngleControls(this.hammer, 0.01, 0.3);
        this.touchZoom = new TouchZoomControls(this.hammer);

        this.mapHeight = new MapHeightControls(0.2, 0.1);

        this.animationTargetHeight = 0;
    }

    /**
     * @param manager {ControlsManager}
     */
    start(manager) {
        this.manager = manager;

        this.rootElement.addEventListener("contextmenu", this.onContextMenu);

        this.mouseMove.start(manager);
        this.mouseRotate.start(manager);
        this.mouseAngle.start(manager);
        this.mouseZoom.start(manager);

        this.keyMove.start(manager);
        this.keyRotate.start(manager);
        this.keyAngle.start(manager);
        this.keyZoom.start(manager);

        this.touchMove.start(manager);
        this.touchRotate.start(manager);
        this.touchAngle.start(manager);
        this.touchZoom.start(manager);

        this.mapHeight.start(manager);


        let startOrtho = this.manager.ortho;
        let startDistance = this.manager.distance;
        let startAngle = this.manager.angle;
        let startY = this.manager.position.y;

        let targetDistance = MathUtils.clamp(this.manager.distance, 100, 10000);
        let targetAngle = Math.min(startAngle, this.getMaxPerspectiveAngleForDistance(targetDistance));

        animate(progress => {
            let smoothProgress = EasingFunctions.easeInOutQuad(progress);

            this.manager.ortho = MathUtils.lerp(startOrtho, 0, progress);
            this.manager.distance = MathUtils.lerp(startDistance, targetDistance, smoothProgress);
            this.manager.angle = MathUtils.lerp(startAngle, targetAngle, smoothProgress);
            this.manager.position.y = MathUtils.lerp(startY, this.animationTargetHeight, smoothProgress);
        }, 500, () => this.started = true);
    }

    stop() {
        this.rootElement.removeEventListener("contextmenu", this.onContextMenu);

        this.mouseMove.stop();
        this.mouseRotate.stop();
        this.mouseAngle.stop();
        this.mouseZoom.stop();

        this.keyMove.stop();
        this.keyRotate.stop();
        this.keyAngle.stop();
        this.keyZoom.stop();

        this.touchMove.stop();
        this.touchRotate.stop();
        this.touchAngle.stop();
        this.touchZoom.stop();

        this.mapHeight.stop();

        this.started = false;
    }

    /**
     * @param delta {number}
     * @param map {Map}
     */
    update(delta, map) {
        if (!this.started){
            this.mapHeight.updateHeights(delta, map);
            this.animationTargetHeight = this.mapHeight.getSuggestedHeight();
            return;
        }

        // move and zoom
        this.mouseMove.update(delta, map);
        this.mouseZoom.update(delta, map);
        this.keyMove.update(delta, map);
        this.keyZoom.update(delta, map);
        this.touchMove.update(delta, map);
        this.touchZoom.update(delta, map);

        this.manager.distance = softClamp(this.manager.distance, 5, 10000, 0.8);

        // max angle for current distance
        let maxAngleForZoom = this.getMaxPerspectiveAngleForDistance(this.manager.distance);

        // rotation
        if (this.manager.ortho === 0) {
            this.mouseRotate.update(delta, map);
            this.keyRotate.update(delta, map);
            this.touchRotate.update(delta, map);
        }

        // tilt
        if (this.manager.ortho === 0) {
            this.mouseAngle.update(delta, map);
            this.keyAngle.update(delta, map);
            this.touchAngle.update(delta, map);
            this.manager.angle = softClamp(this.manager.angle, 0, maxAngleForZoom, 0.8);
        }

        // target height
        if (this.manager.ortho === 0 || this.manager.angle === 0) {
            this.manager.position.y = 0;
            this.mapHeight.maxAngle = maxAngleForZoom;
            this.mapHeight.update(delta, map);
        }
    }

    reset() {
        this.mouseMove.reset();
        this.mouseRotate.reset();
        this.mouseAngle.reset();
        this.mouseZoom.reset();

        this.touchMove.reset();
        this.touchRotate.reset();
        this.touchAngle.reset();
        this.touchZoom.reset();
    }

    getMaxPerspectiveAngleForDistance(distance) {
        return MathUtils.clamp((1 - Math.pow(Math.max(distance - 5, 0.001) / 500, 0.5)) * HALF_PI,0, HALF_PI)
    }

    setPerspectiveView() {
        this.reset();

        let startOrtho = this.manager.ortho;
        let startAngle = this.manager.angle;

        let targetAngle = Math.min(startAngle, this.getMaxPerspectiveAngleForDistance(this.manager.distance));

        animate(progress => {
            let smoothProgress = EasingFunctions.easeInOutQuad(progress);

            this.manager.ortho = MathUtils.lerp(startOrtho, 0, progress);
            this.manager.angle = MathUtils.lerp(startAngle, targetAngle, smoothProgress);
        }, 500);
    }

    setOrthographicView(targetRotation = 0, targetAngle = 0) {
        this.reset();

        let startOrtho = this.manager.ortho;
        let startAngle = this.manager.angle;
        let startRotation = this.manager.rotation;

        animate(progress => {
            let smoothProgress = EasingFunctions.easeInOutQuad(progress);

            this.manager.ortho = MathUtils.lerp(startOrtho, 1, progress);
            this.manager.angle = MathUtils.lerp(startAngle, targetAngle, smoothProgress);
            this.manager.rotation = MathUtils.lerp(startRotation, targetRotation, smoothProgress);
        }, 500);
    }

    initializeHammer() {
        let touchTap = new Hammer.Tap({ event: 'tap', pointers: 1, taps: 1, threshold: 2 });
        let touchMove = new Hammer.Pan({ event: 'move', pointers: 1, direction: Hammer.DIRECTION_ALL, threshold: 0 });
        let touchTilt =  new Hammer.Pan({ event: 'tilt', pointers: 2, direction: Hammer.DIRECTION_VERTICAL, threshold: 0 });
        let touchRotate = new Hammer.Rotate({ event: 'rotate', pointers: 2, threshold: 0 });
        let touchZoom = new Hammer.Pinch({ event: 'zoom', pointers: 2, threshold: 0 });

        touchMove.recognizeWith(touchRotate);
        touchMove.recognizeWith(touchTilt);
        touchMove.recognizeWith(touchZoom);
        touchTilt.recognizeWith(touchRotate);
        touchTilt.recognizeWith(touchZoom);
        touchRotate.recognizeWith(touchZoom);

        this.hammer.add(touchTap);
        this.hammer.add(touchTilt);
        this.hammer.add(touchMove);
        this.hammer.add(touchRotate);
        this.hammer.add(touchZoom);
    }

    onContextMenu = evt => {
        evt.preventDefault();
    }

}