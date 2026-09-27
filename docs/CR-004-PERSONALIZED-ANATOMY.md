# CR-004 — Personalized anatomy

Status: Implemented

## Problem

Torso-scale normalization removes most effects of camera distance and overall body size, but it does not make different human proportions identical.

Two people can perform the same technique with the same joint directions while having different:
- upper-arm lengths;
- forearm lengths;
- thigh/shin lengths;
- shoulder/hip width.

A matcher based on body-relative coordinates can therefore punish anatomy instead of technique.

## Live calibration

Every drill now starts with a short session calibration.

The browser measures limb lengths from torso-normalized MediaPipe landmarks:
- upper arms;
- forearms;
- thighs;
- shins;
- optional shoulder/hip width and feet.

Real centimetres are never required.

A small profile is stored locally in `localStorage`. Every new drill session samples fresh landmarks before matching starts and blends them into the saved profile.

Side-view occlusion is handled conservatively: if one limb is consistently visible, its measured length can be used as a fallback for the hidden side.

The user can explicitly select **Перекалибровать** to discard the saved profile.

## Retargeting

The source target pose keeps its technique:
- joint directions;
- elbow/knee bend;
- torso direction;
- stance intent;
- sword direction.

Bone lengths are rebuilt using the user's measured proportions.

The personalized target is used by both:
- the visible spectral target / manuscript target;
- `checkpointMatcher`.

This preserves the single-machine-target principle: the user does not see one pose while being scored against another.

## Offline video analysis

Detailed video comparison is anatomy-aware too.

Before DTW/features:
1. both sequences are torso-normalized;
2. body proportions are measured from the attempt;
3. the trainer/reference sequence is retargeted to the attempt's body proportions;
4. features, segmentation, DTW and feedback run on the personalized reference.

The goal is to compare movement technique rather than trainer-vs-student limb lengths.

## What this does not solve

Personalized anatomy does not remove all camera error.

Still relevant:
- camera too close / strong perspective distortion;
- camera height and tilt;
- occlusion;
- MediaPipe landmark error;
- genuine technique differences that look similar from one camera.

Those should be handled by camera-quality guidance and, where needed, future multi-view or weapon tracking.
