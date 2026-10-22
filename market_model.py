# Evidentra bottom-up market model. All inputs are ASSUMPTIONS unless noted. INR crore = 1e7.
S={'Low':dict(nm=800,nc=300,acv_m=60_000,acv_c=120_000,sam=.15,som=.02),
   'Base':dict(nm=3000,nc=600,acv_m=150_000,acv_c=300_000,sam=.30,som=.06),
   'High':dict(nm=6000,nc=1200,acv_m=300_000,acv_c=600_000,sam=.45,som=.12)}
CR=1e7
out={}
for k,s in S.items():
    tam=s['nm']*s['acv_m']+s['nc']*s['acv_c']
    sam=tam*s['sam']; som=sam*s['som']
    cust_m=s['nm']*s['sam']*s['som']; cust_c=s['nc']*s['sam']*s['som']
    out[k]=dict(TAM=tam/CR,SAM=sam/CR,SOM=som/CR,cm=cust_m,cc=cust_c,tam_l=tam,sam_l=sam,som_l=som)
    print(k,{a:round(b,3) for a,b in out[k].items()})
import json;json.dump(out,open('model.json','w'))
