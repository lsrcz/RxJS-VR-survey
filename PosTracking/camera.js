/**
 * @license
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
import * as posenet from '@tensorflow-models/posenet';
import Stats from 'stats.js';
import {
  Observable
} from 'rxjs';
import {
  filter,
  map
} from 'rxjs/operators'

import {
  drawBoundingBox,
  drawKeypoints,
  drawSkeleton,
  isMobile,
  toggleLoadingUI,
} from './demo_util';

const videoWidth = 4 * 60;
const videoHeight = 3 * 60;
const stats = new Stats();

/**
 * Loads a the camera to be used in the demo
 *
 */
async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(
      'Browser API navigator.mediaDevices.getUserMedia not available');
  }

  const video = document.getElementById('video');
  video.width = videoWidth;
  video.height = videoHeight;

  const mobile = isMobile();
  const stream = await navigator.mediaDevices.getUserMedia({
    'audio': false,
    'video': {
      facingMode: 'user',
      width: mobile ? undefined : videoWidth,
      height: mobile ? undefined : videoHeight,
    },
  });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

async function loadVideo() {
  const video = await setupCamera();
  video.play();

  return video;
}

const defaultQuantBytes = 2;

const defaultResNetMultiplier = 1.0;
const defaultResNetStride = 32;
const defaultResNetInputResolution = 257;

const defaultSingleMinPoseConfidence = 0.1;
const defaultSingleMinPartConfidence = 0.5;

const defaultMultiMinPoseConfidence = 0.1;
const defaultMultiMinPartConfidence = 0.5;
const defaultMultiNMSRadius = 30.0;
const defaultMultiPoseDetections = 5;

/**
 * Sets up a frames per second panel on the top-left of the window
 */
function setupFPS() {
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
  document.getElementById('main').appendChild(stats.dom);
}

/**
 * Feeds an image to posenet to estimate poses - this is where the magic
 * happens. This function loops with a requestAnimationFrame method.
 */
function detectPoseInRealTime(video, net) {
  const canvas = document.getElementById('output');
  const ctx = canvas.getContext('2d');

  // since images are being fed from a webcam, we want to feed in the
  // original image and then just flip the keypoints' x coordinates. If instead
  // we flip the image, then correcting left-right keypoint pairs requires a
  // permutation on all the keypoints.
  const flipPoseHorizontal = true;

  canvas.width = videoWidth;
  canvas.height = videoHeight;

  const posestream = Observable.create(observer => {
    async function poseDetectionData() {
      // Begin monitoring code for frames per second
      stats.begin();

      // let poses = [];
      let minPoseConfidence;
      let minPartConfidence;
      let poses = await net.estimatePoses(video, {
        flipHorizontal: flipPoseHorizontal,
        decodingMethod: 'multi-person',
        maxDetections: defaultMultiPoseDetections,
        scoreThreshold: defaultMultiMinPartConfidence,
        nmsRadius: defaultMultiPoseDetections
      });
      minPoseConfidence = +defaultMultiMinPoseConfidence;
      minPartConfidence = +defaultMultiMinPartConfidence;

      ctx.clearRect(0, 0, videoWidth, videoHeight);

      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-videoWidth, 0);
      ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
      ctx.restore();

      // For each pose (i.e. person) detected in an image, loop through the poses
      // and draw the resulting skeleton and keypoints if over certain confidence
      // scores

      poses.forEach(({score, keypoints}) => {
        if (score >= minPoseConfidence) {
          drawKeypoints(keypoints, minPartConfidence, ctx);
          drawSkeleton(keypoints, minPartConfidence, ctx);
          drawBoundingBox(keypoints, ctx);
        }
      });

      // End monitoring code for frames per second

      stats.end();
      observer.next(poses);
      requestAnimationFrame(poseDetectionData);
      // return poses;
    }

    poseDetectionData();
  });

  return posestream;

}

/**
 * Kicks off the demo by loading the posenet model, finding and loading
 * available camera devices, and setting off the detectPoseInRealTime function.
 */

export async function bindPage() {
  toggleLoadingUI(true);
  const net = await posenet.load({
    architecture: "ResNet50",
    outputStride: defaultResNetStride,
    inputResolution: defaultResNetInputResolution,
    multiplier: defaultResNetMultiplier,
    quantBytes: defaultQuantBytes
  });
  toggleLoadingUI(false);

  let video;

  try {
    video = await loadVideo();
  } catch (e) {
    let info = document.getElementById('info');
    info.textContent = 'this browser does not support video capture,' +
      'or this device does not have a camera';
    info.style.display = 'block';
    throw e;
  }

  setupFPS();
  let posestream = await detectPoseInRealTime(video, net);
  
  var sceneEl = document.querySelector('a-scene');
  var boxEl = sceneEl.querySelector('a-box');
  posestream.pipe(
    filter(poses => poses.length > 0),
    filter(poses => poses[0].score > defaultMultiMinPoseConfidence),
    map(poses => poses[0]),
    map(({score, keypoints}) => {
      var keypointsRet = {};
      keypoints.forEach(({
        score,
        part,
        position
      }) => {
        Object.defineProperty(keypointsRet, part, {
          value: {
            score: score,
            position: position
          },
          writable: false
        });
      })
      return {
        score: score,
        keypoints: keypointsRet
      };
    }),
    map(pose => pose.keypoints),
    filter(keypoints => {
      return keypoints.leftWrist.score > defaultMultiMinPartConfidence &&
      keypoints.rightWrist.score > defaultMultiMinPartConfidence &&
      keypoints.leftShoulder.score > defaultMultiMinPartConfidence &&
      keypoints.rightShoulder.score > defaultMultiMinPartConfidence
    }),
    map(keypoints => {
      return {
        leftWrist: keypoints.leftWrist.position,
        rightWrist: keypoints.rightWrist.position,
        leftShoulder: keypoints.leftShoulder.position,
        rightShoulder: keypoints.rightShoulder.position,
      };
    })
  ).subscribe(({leftWrist, rightWrist, leftShoulder, rightShoulder}) => {
      let wristDiffX = rightWrist.x - leftWrist.x;
      let wristDiffY = leftWrist.y - rightWrist.y;
      let wristCenterX = (rightWrist.x + leftWrist.x) / 2;
      let wristCenterY = (leftWrist.y + rightWrist.y) / 2;
      let shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
      let shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
      let atan = Math.atan2(wristDiffY, wristDiffX) * 180 / Math.PI;
      boxEl.setAttribute('rotation', {x: 0, y: 0, z: atan});

      let offsetX = wristCenterX - shoulderCenterX;
      let offsetY = shoulderCenterY - wristCenterY;
      boxEl.setAttribute('position', {x: offsetX / 50, y: offsetY / 50 + 2, z: -3});
  });

}

navigator.getUserMedia = navigator.getUserMedia ||
  navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
// kick off the demo

bindPage();

