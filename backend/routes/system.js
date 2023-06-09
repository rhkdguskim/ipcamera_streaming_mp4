var express = require("express");
const expressWs = require("express-ws");
const diskinfo = require('node-disk-info');
const os = require('os-utils');
const si = require('systeminformation');

const Datastore = require('nedb');
const db = new Datastore({ filename: 'db/DiskDB', autoload: true });

const router = express.Router();

expressWs(router);

const DiskList = new Map();

db.find({}, (err, diskList) => {
    if(err)
    {
        console.log("error");
    }
    else
    {
        diskinfo.getDiskInfo()
            .then(disks => {
                for(idx in diskList)
                {
                    const disk = disks.filter( disk => diskList[idx].id === disk._mounted);
                    if(disk.length !== 0)
                    {
                        DiskList.set(diskList[idx].id, disk);
                    }
                }
            })
            .catch(err => {
                res.status(500).send(err.message);
            });
    }
})

function ReloadData() {
    db.loadDatabase();
}

router.ws('/data', (ws, req) => {
    console.log("hi");
    const sendUsage = () => {
        os.cpuUsage((cpuUsage) => {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memory = Math.round((usedMemory / totalMemory) * 100);
        
        let total = 0;
        let free = 0;

        DiskList.forEach((values, key) => {
            total =+ values[0]._blocks;
        })

        DiskList.forEach((values, key) => {
            free =+ values[0]._available;
        })
        const network = 0;
      si.networkInterfaces()
      .then((interfaces) => {
        const networkInterface = interfaces[0];
        si.networkStats(networkInterface.iface)
        .then((stats) => {
            //console.log(stats);
            const network = {rx:stats.rx_bytes, tx:stats.tx_bytes}
            const used = total - free;
            const disk = Math.round((used / total) * 100) || 0;
            const cpu = Math.round((cpuUsage) * 100)
            ws.send(JSON.stringify({ cpu, memory, disk, network }));
           })
        });
      })
    };

    sendUsage();

    const intervalId = setInterval(sendUsage, 1000);

    ws.on("message ", (data) => {
        console.log(data);
    })

    ws.on('close', () => {
        clearInterval(intervalId);
    });
});

router.get('/sdisk', (req, res) => {
    diskinfo.getDiskInfo()
    .then(disks => {
      // Log the list of disks
      const newData = disks.map((item) => ({
        ...item,
        id: item._mounted,
      }));

      res.status(201).send(newData);
    })
    .catch(err => {
        res.status(500).send(err.message);
    });
});

router.get('/disk', (req, res) => {
    db.find({}, (err, disklist) => {
        if (err) {
            res.status(500).send(err.message);
        }
        else{
            res.status(201).send(disklist);
        }
    })
});

router.post('/disk', (req, res) => {
    const disk = {
        id:req.body.id,
        name:req.body.name,
        limit:req.body.limit,
        mounted:req.body.mounted,
        path:req.body.path,
    };
      
    db.insert(disk, (err, result) => {
        if (err) {
            res.status(500).send(err.message);
        }
        else {
            res.status(201).send(result);
            ReloadData();
        }
    })
});

router.delete('/disk', (req,res) => {
    db.remove({id:req.body.id}, {}, (err, numRemoved) => {
        if(err) {
            res.status(500).send(err.message);
        }
        else{
            res.status(201).send(numRemoved.toString());
            ReloadData();
        }
    })
});

router.put('/disk', (req,res) => {
    db.update({ id:req.body.id}, { $set: { name:req.body.name, limit:req.body.limit, mounted:req.body.mounted} } , { upsert: true } , (err, numRemoved) => {
        if(err) {
            console.log(err.message);
            res.status(500).send(err.message);
        }
        else{
            res.status(201).send(numRemoved.toString());
            ReloadData();
        }
    })
    
});

module.exports = router;