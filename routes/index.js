var express = require("express");
var router = express.Router();
const stock_read_log = require("../models/stock_read_log");
const FileSystem = require("fs");

router.use("/export-data", async (req, res) => {
  const list = await stock_read_log
    .aggregate([
      {
        $match: {},
      },
    ])
    .exec();

  FileSystem.writeFile(
    "./stock_read_log.json",
    JSON.stringify(list),
    (error) => {
      if (error) throw error;
    }
  );

  console.log("stock_read_log.json exported!");
  res.json({ statusCode: 1, message: "stock_read_log.json exported!" });
});

router.use("/import-data", async (req, res) => {
  const list = await stock_read_log
    .aggregate([
      {
        $match: {},
      },
    ])
    .exec();

  FileSystem.readFile("./stock_read_log.json", async (error, data) => {
    if (error) throw error;
    const list = JSON.parse(data);

    const deletedAll = await stock_read_log.deleteMany({});

    const insertedAll = await stock_read_log.insertMany(list);

    console.log("stock_read_log.json imported!");
    res.json({ statusCode: 1, message: "stock_read_log.json imported!" });
  });
});

router.use("/edit-repacking-data", async (req, res) => {
  // Silahkan dikerjakan disini.
  const { company_id, payload, reject_qr_list, new_qr_list } = req.body;
  try {
    const filter = { company_id };
    const all_data = await stock_read_log.find(filter);

    // filtering dan validate stock
    const filter_data_by_payload = find_stock_data({ all_data, payload });
    if (!filter_data_by_payload) {
      res.json({ statusCode: 404, message: "stock not found!" });
      return;
    }

    // looping all_data
    for (let i = 0; i < all_data.length; i++) {
      const item = all_data[i];
      const { qr_list } = item;
      await to_update_stock_rejected({ item, reject_qr_list });
      const [new_list, new_data] = await finder_and_remover({
        qr_list,
        new_qr_list,
        filter_data_by_payload,
        reject_qr_list,
      });
      all_data[i].qr_list = new_list;
      filter_data_by_payload.qr_list = new_data;
      all_data[i].qty = sum_qty(all_data[i].qr_list);

      const update_payload = {
        $set: { ...all_data[i] },
      };
      await stock_read_log.updateOne(
        { ...filter, _id: all_data[i]._id },
        update_payload
      );
    }
    
    await stock_read_log.updateOne(
      { ...filter, _id: filter_data_by_payload._id },
      {
        $set: {
          ...filter_data_by_payload,
        },
      }
    );

    console.log("edit-repacking-data successfully");
    return res.status(201).json({
      statusCode: 201,
      message: "edit-repacking-data successfully",
      // data: all_data,
    });
  } catch (error) {
    console.log("error from edit data packing", error);
  }
});

const finder_and_remover = async (props) => {
  let { qr_list, new_qr_list, filter_data_by_payload, reject_qr_list } = props;
  const new_list = [];
  qr_list = qr_list?.filter((item1) => {
    if (!new_qr_list.some((item2) => item1.payload === item2.payload)) {
      new_list.push(item1);
    } else {
      item1.qr_count = 1;
      filter_data_by_payload.qr_list.push(item1);
    }
  });

  //  compare and reduce with rejected list
  filter_data_by_payload.qr_list = reduce_qr_list(
    filter_data_by_payload.qr_list,
    reject_qr_list
  );
  filter_data_by_payload.qty = sum_qty(filter_data_by_payload.qr_list);
  return [new_list, filter_data_by_payload.qr_list];
};

const find_stock_data = (props) => {
  const { all_data = [], payload } = props;
  const filter_data_by_payload = all_data?.filter((e) => e.payload === payload);
  if (filter_data_by_payload.length <= 0) {
    return false;
  }
  return filter_data_by_payload[0];
};

const reduce_qr_list = (arr1, arr2) => {
  return arr1?.filter(
    (item1) => !arr2.some((item2) => item1.payload === item2.payload)
  );
};

const sum_qty = (data = []) => {
  let total = 1;
  if (data.length > 0) {
    total = data.length;
  }
  return total;
};

const to_update_stock_rejected = async (props) => {
  const { item, reject_qr_list = [] } = props;
  for (let i = 0; i < reject_qr_list.length; i++) {
    const e = reject_qr_list[i];
    if (item.payload === e.payload) {
      item.status_repacking = 0;
      item.status = 0;
      item.status_qc = 1;
      item.status_pick = 0;
      item.stock_type = 0;
      // console.log(item, "itemmmmmmmmmmmmmmmmmmmmmmmmmmmm");
      return item;
    }
  }
  return false;
};

router.use("/", function (req, res, next) {
  res.render("index", { title: "Express" });
});

module.exports = router;
