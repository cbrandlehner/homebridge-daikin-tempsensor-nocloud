'use strict';

const modelInfo = [
  'ret=OK,model=0AB9,type=N,pv=2,cpv=2,cpv_minor=00,mid=NA,humd=1,s_humd=1',
  'acled=0,land=0,elec=0,temp=1,temp_rng=0,m_dtct=1,ac_dst=--,disp_dry=0,dmnd=0',
  'en_scdltmr=1,en_frate=1,en_fdir=1,s_fdir=3,en_rtemp_a=1,en_spmode=0,en_ipw_sep=0,en_mompow=0',
].join(',');

const basicInfo = 'ret=OK,ver=3.4.6,pow=1';

const sensorInfo = 'ret=OK,htemp=24.5,hhum=55,otemp=18.0';

function createDefaultState() {
  return {
    modelInfo,
    basicInfo,
    sensorInfo,
  };
}

module.exports = {
  createDefaultState,
};
