import type { AlignmentPair, ComparisonResult, FeedbackItem, MetricFeature, Severity, TimelineMarker } from "../types";
import type { AnalysisProfile, FeatureSpec, Observation, PhaseSpan, PreparedMotion } from "./types";

const SEVERITY_WEIGHT: Record<Severity, number> = { info: 1, warning: 2, major: 3 };

export function compareMotion(
  reference: PreparedMotion,
  attempt: PreparedMotion,
  alignment: AlignmentPair[],
  profile: AnalysisProfile,
  movementId: string,
): ComparisonResult {
  const observations: Observation[] = [];
  const metrics: Record<string, MetricFeature> = {};
  let similarityWeight = 0;
  let similarityAcc = 0;

  for (const [name, spec] of Object.entries(profile.features)) {
    const { rows, meanAbs, similarity } = featureObservations(name, spec, reference, attempt, alignment);
    observations.push(...rows);
    metrics[name] = {
      label: spec.label || name,
      unit: spec.unit,
      weight: spec.weight,
      mean_abs_delta: meanAbs == null ? null : round(meanAbs, 4),
      phases: Object.fromEntries(rows.map((row) => [row.phase, {
        reference: round(row.reference, 4),
        attempt: round(row.attempt, 4),
        delta: round(row.delta, 4),
        severity: row.severity,
      }])),
    };
    if (similarity != null && spec.weight > 0) {
      similarityWeight += spec.weight;
      similarityAcc += spec.weight * similarity;
    }
  }

  const similarity = similarityWeight > 0 ? round(100 * similarityAcc / similarityWeight, 1) : null;
  const feedback = selectFeedback(observations, profile, 3);
  const markers = timelineMarkers(reference, attempt, alignment, profile);

  return {
    movement_id: movementId,
    reliable: true,
    message: feedback.length ? null : "Явных расхождений с эталоном по выбранным признакам не найдено.",
    similarity,
    quality: { pose_detection_ratio: 1, reliable: true, reasons: [] },
    feedback,
    alignment,
    metrics,
    largest_deviations: observations
      .filter((item) => item.severity !== "info")
      .sort((a,b)=>scoreObservation(b)-scoreObservation(a))
      .slice(0,5)
      .map((item)=>({
        feature:item.feature, phase:item.phase, delta:round(item.delta,4), severity:item.severity,
      })),
    timeline_markers: markers,
  };
}

function featureObservations(
  name:string,
  spec:FeatureSpec,
  reference:PreparedMotion,
  attempt:PreparedMotion,
  alignment:AlignmentPair[],
) {
  const source=spec.source ?? name;
  const refCount=Math.max(reference.timestamps_ms.length,1);

  if(spec.reduce==="std"){
    const refValues=activeValues(reference,source,reference.phases);
    const attValues=alignedValues(attempt,alignment,source,reference.phases);
    if(refValues.length<2||attValues.length<2) return {rows:[],meanAbs:null,similarity:null};
    const refStat=std(refValues), attStat=std(attValues), delta=attStat-refStat;
    const pair=alignment[Math.floor(alignment.length/2)] ?? alignment[0];
    if(!pair) return {rows:[],meanAbs:null,similarity:null};
    const row:Observation={
      feature:name,phase:"overall",phase_position:.5,reference:refStat,attempt:attStat,delta,
      severity:severity(Math.abs(delta),spec),weight:spec.weight,duration_fraction:1,
      unit:spec.unit,label:spec.label||name,
      reference_frame:pair.reference_frame,attempt_frame:pair.attempt_frame,
      reference_time_ms:pair.reference_time_ms,attempt_time_ms:pair.attempt_time_ms,
    };
    return {rows:[row],meanAbs:Math.abs(delta),similarity:featureSimilarity(Math.abs(delta),spec)};
  }

  const refSeries=reference.features[source]??[], attSeries=attempt.features[source]??[];
  if(!refSeries.length||!attSeries.length) return {rows:[],meanAbs:null,similarity:null};
  const phases=reference.phases.length?reference.phases:[{name:"overall",start_frame:0,end_frame:refSeries.length}];
  const rows:Observation[]=[];
  const absSamples:number[]=[];

  for(const phase of phases){
    const refValues:number[]=[], attValues:number[]=[];
    let representative:AlignmentPair|null=null;
    for(const pair of alignment){
      if(pair.reference_frame<phase.start_frame||pair.reference_frame>=phase.end_frame) continue;
      const rv=refSeries[pair.reference_frame], av=attSeries[pair.attempt_frame];
      if(!Number.isFinite(rv)||!Number.isFinite(av)) continue;
      refValues.push(rv);attValues.push(av);absSamples.push(Math.abs(av-rv));representative=pair;
    }
    if(!refValues.length||!representative) continue;
    const refMean=mean(refValues),attMean=mean(attValues),delta=attMean-refMean;
    const duration=Math.max((phase.end_frame-phase.start_frame)/refCount,.05);
    const mid=(phase.start_frame+phase.end_frame-1)/2;
    rows.push({
      feature:name,phase:phase.name,phase_position:mid/Math.max(refCount-1,1),
      reference:refMean,attempt:attMean,delta,severity:severity(Math.abs(delta),spec),
      weight:spec.weight,duration_fraction:duration,unit:spec.unit,label:spec.label||name,
      reference_frame:representative.reference_frame,attempt_frame:representative.attempt_frame,
      reference_time_ms:representative.reference_time_ms,attempt_time_ms:representative.attempt_time_ms,
    });
  }
  const meanAbs=absSamples.length?mean(absSamples):null;
  return {rows,meanAbs,similarity:featureSimilarity(meanAbs,spec)};
}

function selectFeedback(observations:Observation[],profile:AnalysisProfile,limit:number):FeedbackItem[]{
  const best=new Map<string,Observation>();
  for(const item of observations){
    if(item.severity==="info"||item.weight<=0) continue;
    const current=best.get(item.feature);
    if(!current||scoreObservation(item)>scoreObservation(current)) best.set(item.feature,item);
  }
  return [...best.values()]
    .sort((a,b)=>scoreObservation(b)-scoreObservation(a)||a.feature.localeCompare(b.feature))
    .slice(0,limit)
    .map((item)=>toFeedback(item,profile));
}

function toFeedback(item:Observation,profile:AnalysisProfile):FeedbackItem{
  const spec=profile.features[item.feature];
  const phase=profile.phases[item.phase]??item.phase;
  const magnitude=formatMagnitude(item.delta,item.unit);
  const template=item.delta>=0?spec?.greater:spec?.less;
  const message=template
    ? template.replaceAll("{phase}",phase).replaceAll("{magnitude}",magnitude).replaceAll("{label}",item.label)
    : `${phase} ${item.label} отличается от эталона примерно на ${magnitude}.`;
  return {severity:item.severity,phase:round(item.phase_position,4),phase_name:item.phase,feature:item.feature,message};
}

function timelineMarkers(reference:PreparedMotion,attempt:PreparedMotion,alignment:AlignmentPair[],profile:AnalysisProfile):TimelineMarker[]{
  const rows:{rank:number;feature:string;severity:Severity}[]=[];
  for(const pair of alignment){
    let rank=0,feature="",level:Severity="info";
    for(const [name,spec] of Object.entries(profile.features)){
      if((spec.reduce??"mean")!=="mean"||spec.weight<=0||warnAt(spec)==null) continue;
      const source=spec.source??name,rv=reference.features[source]?.[pair.reference_frame],av=attempt.features[source]?.[pair.attempt_frame];
      if(!Number.isFinite(rv)||!Number.isFinite(av)) continue;
      const sev=severity(Math.abs((av as number)-(rv as number)),spec);
      const r=sev==="major"?2:sev==="warning"?1:0;
      if(r>rank){rank=r;feature=name;level=sev;}
    }
    rows.push({rank,feature,severity:level});
  }
  const markers:TimelineMarker[]=[];let i=0;
  while(i<rows.length){
    if(rows[i].rank<1){i++;continue;}
    let end=i;while(end<rows.length&&rows[end].rank>=1)end++;
    let peak=i;for(let j=i+1;j<end;j++)if(rows[j].rank>rows[peak].rank)peak=j;
    const pair=alignment[peak];
    markers.push({
      position:pair.reference_frame/Math.max(reference.timestamps_ms.length-1,1),
      severity:rows[peak].severity,feature:rows[peak].feature,
      reference_time_ms:pair.reference_time_ms,attempt_time_ms:pair.attempt_time_ms,
    });
    i=end;
  }
  return markers;
}

function severity(delta:number,spec:FeatureSpec):Severity{
  const major=majorAt(spec),warn=warnAt(spec);
  if(major!=null&&delta>=major)return"major";
  if(warn!=null&&delta>=warn)return"warning";
  return"info";
}
function featureSimilarity(meanAbs:number|null,spec:FeatureSpec){
  const major=majorAt(spec);
  if(meanAbs==null||major==null||major<=0||spec.weight<=0)return null;
  return Math.max(0,1-meanAbs/major);
}
function warnAt(s:FeatureSpec){return s.warning_threshold_deg??s.warning_threshold;}
function majorAt(s:FeatureSpec){return s.major_threshold_deg??s.major_threshold;}
function activeValues(m:PreparedMotion,source:string,phases:PhaseSpan[]){
  const series=m.features[source]??[];
  if(!phases.length)return finite(series);
  const start=Math.min(...phases.map(p=>p.start_frame)),end=Math.max(...phases.map(p=>p.end_frame));
  return finite(series.slice(start,end));
}
function alignedValues(m:PreparedMotion,alignment:AlignmentPair[],source:string,phases:PhaseSpan[]){
  const series=m.features[source]??[];
  if(!phases.length)return finite(series);
  const start=Math.min(...phases.map(p=>p.start_frame)),end=Math.max(...phases.map(p=>p.end_frame));
  return finite(alignment.filter(p=>p.reference_frame>=start&&p.reference_frame<end).map(p=>series[p.attempt_frame]));
}
function scoreObservation(o:Observation){return SEVERITY_WEIGHT[o.severity]*o.weight*o.duration_fraction;}
function finite(values:number[]){return values.filter(Number.isFinite);}
function mean(values:number[]){return values.reduce((a,b)=>a+b,0)/values.length;}
function std(values:number[]){const m=mean(values);return Math.sqrt(mean(values.map(v=>(v-m)**2)));}
function formatMagnitude(delta:number,unit:string){const v=Math.abs(delta);return unit==="degrees"?`${v.toFixed(0)}°`:unit==="torso_lengths"?`${(v*100).toFixed(0)}% длины корпуса`:v.toFixed(2);}
function round(v:number,d:number){const p=10**d;return Math.round(v*p)/p;}
